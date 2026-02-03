import { logger } from "../utils/logger.js";
import { cacheService } from "./cache.service.js";

// API Keys from environment
const RAPID_API_KEY = process.env.RAPID_API_KEY || "";
const RAPID_API_HOST = "irctc1.p.rapidapi.com";

export interface TrainLiveStatus {
  trainNumber: string;
  trainName: string;
  currentStation: string;
  currentStationName: string;
  lastStation: string;
  lastStationName: string;
  nextStation: string;
  nextStationName: string;
  delayMinutes: number;
  etaNextStation: string;
  lastUpdated: string;
  position?: {
    lat: number;
    lng: number;
  };
  status: "running" | "arrived" | "departed" | "not_started" | "terminated";
}

export interface PNRStatus {
  pnr: string;
  trainNumber: string;
  trainName: string;
  journeyDate: string;
  boardingPoint: string;
  boardingPointName: string;
  destination: string;
  destinationName: string;
  reservationUpTo: string;
  classType: string;
  chartPrepared: boolean;
  passengers: Array<{
    number: number;
    bookingStatus: string;
    currentStatus: string;
    coachPosition?: number;
  }>;
}

export interface TrainSchedule {
  trainNumber: string;
  trainName: string;
  trainType: string;
  sourceStation: string;
  sourceStationName: string;
  destinationStation: string;
  destinationStationName: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  distance: number;
  runningDays: number[];
  route: Array<{
    stationCode: string;
    stationName: string;
    arrivalTime: string | null;
    departureTime: string | null;
    haltMinutes: number;
    dayOffset: number;
    distanceFromSource: number;
    platform?: string;
  }>;
}

export interface TrainBetweenStations {
  trainNumber: string;
  trainName: string;
  trainType: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  sourceStation: string;
  destinationStation: string;
  runningDays: number[];
  classes: string[];
}

class RailwayAPIService {
  private headers = {
    "x-rapidapi-key": RAPID_API_KEY,
    "x-rapidapi-host": RAPID_API_HOST,
  };

  private isApiConfigured(): boolean {
    return RAPID_API_KEY.length > 0;
  }

  /**
   * Fetch live running status of a train
   */
  async getLiveStatus(trainNumber: string, date: string): Promise<TrainLiveStatus | null> {
    // Check cache first
    const cached = await cacheService.getLivePosition(trainNumber, date);
    if (cached) {
      return cached as TrainLiveStatus;
    }

    try {
      if (this.isApiConfigured()) {
        // Format date as YYYYMMDD
        const formattedDate = date.replace(/-/g, "");

        const response = await fetch(
          `https://irctc1.p.rapidapi.com/api/v1/liveTrainStatus?trainNo=${trainNumber}&startDay=${formattedDate}`,
          { headers: this.headers }
        );

        if (response.ok) {
          const data = await response.json();
          logger.info({ trainNumber, apiResponse: data.status, hasData: !!data.data, dataSuccess: data.data?.success }, "Live status API response");

          // Check both outer status AND inner data.success
          if (data.status && data.data && data.data.success !== false) {
            // Only transform if we have actual live train data (not an error response)
            if (data.data.current_station_code || data.data.currentStation || data.data.train_name) {
              const liveData = this.transformLiveStatus(data.data, trainNumber);
              await cacheService.setLivePosition(trainNumber, date, liveData);
              return liveData;
            }
          }

          // If API returned but with no actual data, log the reason
          if (data.data?.message) {
            logger.warn({ trainNumber, message: data.data.message }, "API returned no live data");
          }
        }
      }

      // Fallback to mock data if API not configured or failed
      logger.warn({ trainNumber }, "Using mock data for live status");
      const mockData = this.getMockLiveStatus(trainNumber, date);
      await cacheService.setLivePosition(trainNumber, date, mockData);
      return mockData;
    } catch (error) {
      logger.error({ error, trainNumber, date }, "Failed to fetch live status");
      return this.getMockLiveStatus(trainNumber, date);
    }
  }

  /**
   * Fetch PNR status - LIVE DATA
   */
  async getPNRStatus(pnr: string): Promise<PNRStatus | null> {
    // Check cache first
    const cached = await cacheService.getPNR(pnr);
    if (cached) {
      return cached as PNRStatus;
    }

    try {
      if (this.isApiConfigured()) {
        const response = await fetch(
          `https://irctc1.p.rapidapi.com/api/v3/getPNRStatus?pnrNumber=${pnr}`,
          { headers: this.headers }
        );

        if (response.ok) {
          const data = await response.json();
          logger.info({ pnr, apiResponse: data.status, hasData: !!data.data, trainNo: data.data?.TrainNo }, "PNR status API response");

          // Check if we got actual PNR data - API returns PascalCase fields (TrainNo, not trainNumber)
          if (data.status && data.data && (data.data.TrainNo || data.data.trainNumber)) {
            const pnrData = this.transformPNRStatus(data.data, pnr);
            await cacheService.setPNR(pnr, pnrData);
            return pnrData;
          }

          // If API returned false status, the PNR is invalid
          if (data.status === false) {
            logger.warn({ pnr, message: data.message }, "PNR not found");
            return null;
          }
        }
      }

      // Fallback to mock data
      logger.warn({ pnr }, "Using mock data for PNR status");
      const mockData = this.getMockPNRStatus(pnr);
      await cacheService.setPNR(pnr, mockData);
      return mockData;
    } catch (error) {
      logger.error({ error, pnr }, "Failed to fetch PNR status");
      return this.getMockPNRStatus(pnr);
    }
  }

  /**
   * Fetch train schedule - LIVE DATA
   */
  async getTrainSchedule(trainNumber: string): Promise<TrainSchedule | null> {
    // Check cache first (longer TTL for schedules)
    const cached = await cacheService.getTrainSchedule(trainNumber);
    if (cached) {
      return cached as TrainSchedule;
    }

    try {
      if (this.isApiConfigured()) {
        const response = await fetch(
          `https://irctc1.p.rapidapi.com/api/v1/getTrainSchedule?trainNo=${trainNumber}`,
          { headers: this.headers }
        );

        if (response.ok) {
          const data = await response.json();

          if (data.status && data.data) {
            const scheduleData = this.transformTrainSchedule(data.data, trainNumber);
            await cacheService.setTrainSchedule(trainNumber, scheduleData);
            return scheduleData;
          }
        }
      }

      // Fallback to mock data
      logger.warn({ trainNumber }, "Using mock data for train schedule");
      const mockData = this.getMockTrainSchedule(trainNumber);
      await cacheService.setTrainSchedule(trainNumber, mockData);
      return mockData;
    } catch (error) {
      logger.error({ error, trainNumber }, "Failed to fetch train schedule");
      return this.getMockTrainSchedule(trainNumber);
    }
  }

  /**
   * Find trains between two stations - LIVE DATA
   */
  async getTrainsBetween(
    fromStation: string,
    toStation: string,
    date: string
  ): Promise<TrainBetweenStations[]> {
    // Check cache first
    const cached = await cacheService.getTrainsBetween(fromStation, toStation, date);
    if (cached) {
      return cached as TrainBetweenStations[];
    }

    try {
      if (this.isApiConfigured()) {
        // Format date as YYYY-MM-DD
        const response = await fetch(
          `https://irctc1.p.rapidapi.com/api/v3/trainBetweenStations?fromStationCode=${fromStation}&toStationCode=${toStation}&dateOfJourney=${date}`,
          { headers: this.headers }
        );

        if (response.ok) {
          const data = await response.json();

          if (data.status && data.data) {
            const trainsData = this.transformTrainsBetween(data.data, fromStation, toStation);
            await cacheService.setTrainsBetween(fromStation, toStation, date, trainsData);
            return trainsData;
          }
        }
      }

      // Fallback to mock data
      logger.warn({ fromStation, toStation }, "Using mock data for trains between stations");
      const mockData = this.getMockTrainsBetween(fromStation, toStation);
      await cacheService.setTrainsBetween(fromStation, toStation, date, mockData);
      return mockData;
    } catch (error) {
      logger.error({ error, fromStation, toStation, date }, "Failed to fetch trains between stations");
      return this.getMockTrainsBetween(fromStation, toStation);
    }
  }

  /**
   * Search stations - LIVE DATA
   */
  async searchStations(query: string): Promise<Array<{ code: string; name: string; city?: string }>> {
    try {
      if (this.isApiConfigured()) {
        const response = await fetch(
          `https://irctc1.p.rapidapi.com/api/v1/searchStation?query=${encodeURIComponent(query)}`,
          { headers: this.headers }
        );

        if (response.ok) {
          const data = await response.json();

          if (data.status && data.data) {
            return data.data.map((station: any) => ({
              code: station.code || station.station_code,
              name: station.name || station.station_name,
              city: station.city,
            }));
          }
        }
      }

      // Fallback to mock stations
      return this.getMockStations(query);
    } catch (error) {
      logger.error({ error, query }, "Failed to search stations");
      return this.getMockStations(query);
    }
  }

  /**
   * Check seat availability - LIVE DATA
   */
  async checkSeatAvailability(
    trainNumber: string,
    fromStation: string,
    toStation: string,
    date: string,
    classType: string
  ): Promise<any> {
    try {
      if (this.isApiConfigured()) {
        const response = await fetch(
          `https://irctc1.p.rapidapi.com/api/v1/checkSeatAvailability?classType=${classType}&fromStationCode=${fromStation}&quota=GN&toStationCode=${toStation}&trainNo=${trainNumber}&date=${date}`,
          { headers: this.headers }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.status && data.data) {
            return data.data;
          }
        }
      }

      return null;
    } catch (error) {
      logger.error({ error }, "Failed to check seat availability");
      return null;
    }
  }

  // Transform API responses to our format
  private transformLiveStatus(data: any, trainNumber: string): TrainLiveStatus {
    return {
      trainNumber,
      trainName: data.train_name || data.trainName || "Unknown",
      currentStation: data.current_station_code || data.currentStation || "",
      currentStationName: data.current_station_name || data.currentStationName || "",
      lastStation: data.previous_station_code || "",
      lastStationName: data.previous_station_name || "",
      nextStation: data.next_station_code || "",
      nextStationName: data.next_station_name || "",
      delayMinutes: parseInt(data.delay || data.late_min || "0", 10),
      etaNextStation: data.eta || new Date().toISOString(),
      lastUpdated: data.updated_time || new Date().toISOString(),
      position: data.position,
      status: this.mapRunningStatus(data.running_status || data.status),
    };
  }

  private transformPNRStatus(data: any, pnr: string): PNRStatus {
    // Handle both PascalCase (RapidAPI) and camelCase field names
    const passengers = data.PassengerStatus || data.passengerList || data.passengers || [];

    return {
      pnr,
      trainNumber: data.TrainNo || data.trainNumber || data.train_number || "",
      trainName: data.TrainName || data.trainName || data.train_name || "",
      journeyDate: data.Doj || data.dateOfJourney || data.doj || "",
      boardingPoint: data.BoardingPoint || data.boardingPoint || data.boarding_point || "",
      boardingPointName: data.BoardingStationName || data.boardingPointName || data.BoardingPoint || "",
      destination: data.To || data.destinationStation || data.destination || "",
      destinationName: data.ReservationUptoName || data.destinationStationName || data.To || "",
      reservationUpTo: data.ReservationUpto || data.reservationUpto || data.reservation_upto || "",
      classType: data.Class || data.journeyClass || data.class || "",
      chartPrepared: data.ChartPrepared === true || data.chartStatus === "Chart Prepared" || data.chart_prepared === true,
      passengers: passengers.map((p: any, i: number) => ({
        number: p.Number || i + 1,
        bookingStatus: p.BookingStatus || p.bookingStatus || p.booking_status || "",
        currentStatus: p.CurrentStatus || p.currentStatus || p.current_status || "",
        coachPosition: p.CoachPosition || p.coachPosition,
      })),
    };
  }

  private transformTrainSchedule(data: any, trainNumber: string): TrainSchedule {
    const route = (data.route || data.stations || []).map((station: any, index: number) => ({
      stationCode: station.station_code || station.stationCode || "",
      stationName: station.station_name || station.stationName || "",
      arrivalTime: station.arrival_time || station.arrivalTime || null,
      departureTime: station.departure_time || station.departureTime || null,
      haltMinutes: parseInt(station.halt_time || station.halt || "0", 10),
      dayOffset: parseInt(station.day || "0", 10),
      distanceFromSource: parseInt(station.distance || "0", 10),
      platform: station.platform,
    }));

    return {
      trainNumber,
      trainName: data.train_name || data.trainName || "",
      trainType: data.train_type || data.trainType || "",
      sourceStation: route[0]?.stationCode || "",
      sourceStationName: route[0]?.stationName || "",
      destinationStation: route[route.length - 1]?.stationCode || "",
      destinationStationName: route[route.length - 1]?.stationName || "",
      departureTime: route[0]?.departureTime || "",
      arrivalTime: route[route.length - 1]?.arrivalTime || "",
      duration: data.duration || "",
      distance: parseInt(data.distance || "0", 10),
      runningDays: this.parseRunningDays(data.run_days || data.runDays || ""),
      route,
    };
  }

  private transformTrainsBetween(data: any[], fromStation: string, toStation: string): TrainBetweenStations[] {
    return data.map((train: any) => ({
      trainNumber: train.train_number || train.trainNumber || "",
      trainName: train.train_name || train.trainName || "",
      trainType: train.train_type || train.trainType || "",
      departureTime: train.from_sta || train.departureTime || "",
      arrivalTime: train.to_sta || train.arrivalTime || "",
      duration: train.duration || "",
      sourceStation: fromStation,
      destinationStation: toStation,
      runningDays: this.parseRunningDays(train.run_days || train.runDays || ""),
      classes: train.class_type || train.classes || [],
    }));
  }

  private mapRunningStatus(status: string): "running" | "arrived" | "departed" | "not_started" | "terminated" {
    const s = (status || "").toLowerCase();
    if (s.includes("running") || s.includes("on the way")) return "running";
    if (s.includes("arrived")) return "arrived";
    if (s.includes("departed")) return "departed";
    if (s.includes("not started") || s.includes("yet to start")) return "not_started";
    if (s.includes("terminated") || s.includes("reached")) return "terminated";
    return "running";
  }

  private parseRunningDays(runDays: string | string[]): number[] {
    if (Array.isArray(runDays)) {
      return runDays.map((d, i) => (d === "Y" || d === "1" ? i : -1)).filter((d) => d >= 0);
    }
    // Parse string like "SMTWTFS" or "1111110"
    const days: number[] = [];
    const str = runDays.toUpperCase();
    const dayMap: Record<string, number> = { S: 0, M: 1, T: 2, W: 3, T2: 4, F: 5, S2: 6 };

    if (str.includes("DAILY")) return [0, 1, 2, 3, 4, 5, 6];

    for (let i = 0; i < str.length && i < 7; i++) {
      if (str[i] === "Y" || str[i] === "1" || (str[i] !== "N" && str[i] !== "0")) {
        days.push(i);
      }
    }
    return days.length > 0 ? days : [0, 1, 2, 3, 4, 5, 6];
  }

  // Mock data for when API is not configured
  private getMockStations(query: string): Array<{ code: string; name: string; city?: string }> {
    const stations = [
      { code: "NDLS", name: "NEW DELHI", city: "Delhi" },
      { code: "BCT", name: "MUMBAI CENTRAL", city: "Mumbai" },
      { code: "HWH", name: "HOWRAH JN", city: "Kolkata" },
      { code: "MAS", name: "CHENNAI CENTRAL", city: "Chennai" },
      { code: "SBC", name: "KSR BENGALURU", city: "Bangalore" },
      { code: "BPL", name: "BHOPAL JN", city: "Bhopal" },
      { code: "JP", name: "JAIPUR JN", city: "Jaipur" },
      { code: "LKO", name: "LUCKNOW NR", city: "Lucknow" },
      { code: "ADI", name: "AHMEDABAD JN", city: "Ahmedabad" },
      { code: "PUNE", name: "PUNE JN", city: "Pune" },
      { code: "AGC", name: "AGRA CANTT", city: "Agra" },
      { code: "GWL", name: "GWALIOR JN", city: "Gwalior" },
      { code: "JHS", name: "JHANSI JN", city: "Jhansi" },
      { code: "MTJ", name: "MATHURA JN", city: "Mathura" },
    ];

    const q = query.toUpperCase();
    return stations.filter(
      (s) => s.code.includes(q) || s.name.includes(q) || s.city?.toUpperCase().includes(q)
    );
  }

  private getMockLiveStatus(trainNumber: string, date: string): TrainLiveStatus {
    return {
      trainNumber,
      trainName: "RAJDHANI EXPRESS",
      currentStation: "AGC",
      currentStationName: "AGRA CANTT",
      lastStation: "MTJ",
      lastStationName: "MATHURA JN",
      nextStation: "GWL",
      nextStationName: "GWALIOR JN",
      delayMinutes: 18,
      etaNextStation: new Date(Date.now() + 45 * 60000).toISOString(),
      lastUpdated: new Date().toISOString(),
      position: {
        lat: 27.1767,
        lng: 78.0081,
      },
      status: "running",
    };
  }

  private getMockPNRStatus(pnr: string): PNRStatus {
    return {
      pnr,
      trainNumber: "12002",
      trainName: "BHOPAL SHATABDI",
      journeyDate: new Date().toISOString().split("T")[0],
      boardingPoint: "NDLS",
      boardingPointName: "NEW DELHI",
      destination: "BPL",
      destinationName: "BHOPAL JN",
      reservationUpTo: "BPL",
      classType: "CC",
      chartPrepared: true,
      passengers: [
        { number: 1, bookingStatus: "CNF/C2/45", currentStatus: "CNF/C2/45", coachPosition: 8 },
        { number: 2, bookingStatus: "CNF/C2/46", currentStatus: "CNF/C2/46", coachPosition: 8 },
      ],
    };
  }

  private getMockTrainSchedule(trainNumber: string): TrainSchedule {
    return {
      trainNumber,
      trainName: "BHOPAL SHATABDI",
      trainType: "Shatabdi",
      sourceStation: "NDLS",
      sourceStationName: "NEW DELHI",
      destinationStation: "BPL",
      destinationStationName: "BHOPAL JN",
      departureTime: "06:00",
      arrivalTime: "13:35",
      duration: "7h 35m",
      distance: 704,
      runningDays: [1, 2, 3, 4, 5, 6],
      route: [
        { stationCode: "NDLS", stationName: "NEW DELHI", arrivalTime: null, departureTime: "06:00", haltMinutes: 0, dayOffset: 0, distanceFromSource: 0, platform: "1" },
        { stationCode: "AGC", stationName: "AGRA CANTT", arrivalTime: "07:56", departureTime: "07:58", haltMinutes: 2, dayOffset: 0, distanceFromSource: 188, platform: "1" },
        { stationCode: "GWL", stationName: "GWALIOR JN", arrivalTime: "09:02", departureTime: "09:05", haltMinutes: 3, dayOffset: 0, distanceFromSource: 306, platform: "3" },
        { stationCode: "JHS", stationName: "JHANSI JN", arrivalTime: "10:15", departureTime: "10:20", haltMinutes: 5, dayOffset: 0, distanceFromSource: 403, platform: "1" },
        { stationCode: "BPL", stationName: "BHOPAL JN", arrivalTime: "13:35", departureTime: null, haltMinutes: 0, dayOffset: 0, distanceFromSource: 704, platform: "1" },
      ],
    };
  }

  private getMockTrainsBetween(from: string, to: string): TrainBetweenStations[] {
    return [
      { trainNumber: "12002", trainName: "BHOPAL SHATABDI", trainType: "Shatabdi", departureTime: "06:00", arrivalTime: "13:35", duration: "7h 35m", sourceStation: from, destinationStation: to, runningDays: [1, 2, 3, 4, 5, 6], classes: ["CC", "EC"] },
      { trainNumber: "12627", trainName: "KARNATAKA EXPRESS", trainType: "Superfast", departureTime: "21:30", arrivalTime: "05:15", duration: "7h 45m", sourceStation: from, destinationStation: to, runningDays: [0, 1, 2, 3, 4, 5, 6], classes: ["1A", "2A", "3A", "SL"] },
      { trainNumber: "12951", trainName: "MUMBAI RAJDHANI", trainType: "Rajdhani", departureTime: "16:25", arrivalTime: "08:15", duration: "15h 50m", sourceStation: from, destinationStation: to, runningDays: [0, 1, 2, 3, 4, 5, 6], classes: ["1A", "2A", "3A"] },
    ];
  }
}

export const railwayAPIService = new RailwayAPIService();
export default railwayAPIService;
