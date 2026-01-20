import { logger } from "../utils/logger.js";
import { cacheService } from "./cache.service.js";
import { retryWithBackoff } from "../utils/helpers.js";

// API Keys from environment
const RAILWAY_API_KEY = process.env.RAILWAY_API_KEY || "";
const RAPID_API_KEY = process.env.RAPID_API_KEY || "";

// API base URLs (these would be actual API endpoints)
const RAILWAY_API_BASE = "https://indianrailapi.com/api/v2";
const RAPID_API_BASE = "https://irctc1.p.rapidapi.com/api/v3";

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
      // In production, this would make actual API calls
      // For now, return mock data for development
      const mockData = this.getMockLiveStatus(trainNumber, date);

      // Cache the result
      await cacheService.setLivePosition(trainNumber, date, mockData);

      return mockData;
    } catch (error) {
      logger.error({ error, trainNumber, date }, "Failed to fetch live status");
      return null;
    }
  }

  /**
   * Fetch PNR status
   */
  async getPNRStatus(pnr: string): Promise<PNRStatus | null> {
    // Check cache first
    const cached = await cacheService.getPNR(pnr);
    if (cached) {
      return cached as PNRStatus;
    }

    try {
      // In production, this would make actual API calls
      const mockData = this.getMockPNRStatus(pnr);

      // Cache the result
      await cacheService.setPNR(pnr, mockData);

      return mockData;
    } catch (error) {
      logger.error({ error, pnr }, "Failed to fetch PNR status");
      return null;
    }
  }

  /**
   * Fetch train schedule
   */
  async getTrainSchedule(trainNumber: string): Promise<TrainSchedule | null> {
    // Check cache first
    const cached = await cacheService.getTrainSchedule(trainNumber);
    if (cached) {
      return cached as TrainSchedule;
    }

    try {
      const mockData = this.getMockTrainSchedule(trainNumber);

      // Cache the result
      await cacheService.setTrainSchedule(trainNumber, mockData);

      return mockData;
    } catch (error) {
      logger.error({ error, trainNumber }, "Failed to fetch train schedule");
      return null;
    }
  }

  /**
   * Find trains between two stations
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
      const mockData = this.getMockTrainsBetween(fromStation, toStation);

      // Cache the result
      await cacheService.setTrainsBetween(fromStation, toStation, date, mockData);

      return mockData;
    } catch (error) {
      logger.error({ error, fromStation, toStation, date }, "Failed to fetch trains between stations");
      return [];
    }
  }

  // Mock data generators for development
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
        {
          number: 1,
          bookingStatus: "CNF/B2/45",
          currentStatus: "CNF/B2/45",
          coachPosition: 8,
        },
        {
          number: 2,
          bookingStatus: "CNF/B2/46",
          currentStatus: "CNF/B2/46",
          coachPosition: 8,
        },
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
      runningDays: [1, 2, 3, 4, 5, 6], // All days except Sunday
      route: [
        {
          stationCode: "NDLS",
          stationName: "NEW DELHI",
          arrivalTime: null,
          departureTime: "06:00",
          haltMinutes: 0,
          dayOffset: 0,
          distanceFromSource: 0,
          platform: "1",
        },
        {
          stationCode: "AGC",
          stationName: "AGRA CANTT",
          arrivalTime: "07:56",
          departureTime: "07:58",
          haltMinutes: 2,
          dayOffset: 0,
          distanceFromSource: 188,
          platform: "1",
        },
        {
          stationCode: "GWL",
          stationName: "GWALIOR JN",
          arrivalTime: "09:02",
          departureTime: "09:05",
          haltMinutes: 3,
          dayOffset: 0,
          distanceFromSource: 306,
          platform: "3",
        },
        {
          stationCode: "JHS",
          stationName: "JHANSI JN",
          arrivalTime: "10:15",
          departureTime: "10:20",
          haltMinutes: 5,
          dayOffset: 0,
          distanceFromSource: 403,
          platform: "1",
        },
        {
          stationCode: "BPL",
          stationName: "BHOPAL JN",
          arrivalTime: "13:35",
          departureTime: null,
          haltMinutes: 0,
          dayOffset: 0,
          distanceFromSource: 704,
          platform: "1",
        },
      ],
    };
  }

  private getMockTrainsBetween(from: string, to: string): TrainBetweenStations[] {
    return [
      {
        trainNumber: "12002",
        trainName: "BHOPAL SHATABDI",
        trainType: "Shatabdi",
        departureTime: "06:00",
        arrivalTime: "13:35",
        duration: "7h 35m",
        sourceStation: from,
        destinationStation: to,
        runningDays: [1, 2, 3, 4, 5, 6],
        classes: ["CC", "EC"],
      },
      {
        trainNumber: "12627",
        trainName: "KARNATAKA EXPRESS",
        trainType: "Superfast",
        departureTime: "21:30",
        arrivalTime: "05:15",
        duration: "7h 45m",
        sourceStation: from,
        destinationStation: to,
        runningDays: [0, 1, 2, 3, 4, 5, 6],
        classes: ["1A", "2A", "3A", "SL"],
      },
      {
        trainNumber: "12001",
        trainName: "BHOPAL SHATABDI",
        trainType: "Shatabdi",
        departureTime: "14:30",
        arrivalTime: "22:05",
        duration: "7h 35m",
        sourceStation: from,
        destinationStation: to,
        runningDays: [1, 2, 3, 4, 5, 6],
        classes: ["CC", "EC"],
      },
    ];
  }
}

export const railwayAPIService = new RailwayAPIService();
export default railwayAPIService;
