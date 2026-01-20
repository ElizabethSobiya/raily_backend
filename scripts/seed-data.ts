import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { stations, trains, trainStops } from "../drizzle/schema.js";

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/railtrack";

const seedData = async () => {
  console.log("Connecting to database...");

  const connection = postgres(connectionString);
  const db = drizzle(connection);

  console.log("Seeding stations...");

  // Seed popular stations
  const stationData = [
    { code: "NDLS", name: "New Delhi", city: "Delhi", state: "Delhi", latitude: "28.6423", longitude: "77.2199", zone: "NR", isJunction: true },
    { code: "BCT", name: "Mumbai Central", city: "Mumbai", state: "Maharashtra", latitude: "18.9698", longitude: "72.8195", zone: "WR", isJunction: true },
    { code: "CSTM", name: "Chhatrapati Shivaji Terminus", city: "Mumbai", state: "Maharashtra", latitude: "18.9402", longitude: "72.8356", zone: "CR", isJunction: true },
    { code: "HWH", name: "Howrah Junction", city: "Kolkata", state: "West Bengal", latitude: "22.5839", longitude: "88.3428", zone: "ER", isJunction: true },
    { code: "MAS", name: "Chennai Central", city: "Chennai", state: "Tamil Nadu", latitude: "13.0827", longitude: "80.2707", zone: "SR", isJunction: true },
    { code: "SBC", name: "Bangalore City Junction", city: "Bengaluru", state: "Karnataka", latitude: "12.9784", longitude: "77.5714", zone: "SWR", isJunction: true },
    { code: "JP", name: "Jaipur Junction", city: "Jaipur", state: "Rajasthan", latitude: "26.9188", longitude: "75.7873", zone: "NWR", isJunction: true },
    { code: "LKO", name: "Lucknow", city: "Lucknow", state: "Uttar Pradesh", latitude: "26.8518", longitude: "80.9462", zone: "NR", isJunction: false },
    { code: "ADI", name: "Ahmedabad Junction", city: "Ahmedabad", state: "Gujarat", latitude: "23.0225", longitude: "72.5714", zone: "WR", isJunction: true },
    { code: "PUNE", name: "Pune Junction", city: "Pune", state: "Maharashtra", latitude: "18.5285", longitude: "73.8742", zone: "CR", isJunction: true },
    { code: "BPL", name: "Bhopal Junction", city: "Bhopal", state: "Madhya Pradesh", latitude: "23.2689", longitude: "77.4125", zone: "WCR", isJunction: true },
    { code: "AGC", name: "Agra Cantt", city: "Agra", state: "Uttar Pradesh", latitude: "27.1575", longitude: "78.0023", zone: "NCR", isJunction: false },
    { code: "GWL", name: "Gwalior Junction", city: "Gwalior", state: "Madhya Pradesh", latitude: "26.2183", longitude: "78.1828", zone: "NCR", isJunction: true },
    { code: "JHS", name: "Jhansi Junction", city: "Jhansi", state: "Uttar Pradesh", latitude: "25.4426", longitude: "78.5691", zone: "NCR", isJunction: true },
    { code: "MTJ", name: "Mathura Junction", city: "Mathura", state: "Uttar Pradesh", latitude: "27.4924", longitude: "77.6737", zone: "NCR", isJunction: true },
    { code: "CNB", name: "Kanpur Central", city: "Kanpur", state: "Uttar Pradesh", latitude: "26.4542", longitude: "80.3524", zone: "NCR", isJunction: true },
    { code: "ALD", name: "Allahabad Junction", city: "Prayagraj", state: "Uttar Pradesh", latitude: "25.4358", longitude: "81.8463", zone: "NCR", isJunction: true },
    { code: "MGS", name: "Mughal Sarai Junction", city: "Mughal Sarai", state: "Uttar Pradesh", latitude: "25.2817", longitude: "83.1183", zone: "ECR", isJunction: true },
    { code: "BSB", name: "Varanasi Junction", city: "Varanasi", state: "Uttar Pradesh", latitude: "25.3176", longitude: "82.9871", zone: "NER", isJunction: true },
    { code: "PNBE", name: "Patna Junction", city: "Patna", state: "Bihar", latitude: "25.6093", longitude: "85.1376", zone: "ECR", isJunction: true },
  ];

  try {
    await db.insert(stations).values(stationData).onConflictDoNothing();
    console.log(`Seeded ${stationData.length} stations`);
  } catch (error) {
    console.log("Stations may already exist, skipping...");
  }

  console.log("Seeding trains...");

  // Seed popular trains
  const trainData = [
    {
      trainNumber: "12002",
      trainName: "BHOPAL SHATABDI",
      trainType: "Shatabdi",
      sourceStation: "NDLS",
      destinationStation: "BPL",
      departureTime: "06:00",
      arrivalTime: "13:35",
      duration: "7h 35m",
      runningDays: [1, 2, 3, 4, 5, 6],
      distance: 704,
    },
    {
      trainNumber: "12001",
      trainName: "BHOPAL SHATABDI",
      trainType: "Shatabdi",
      sourceStation: "BPL",
      destinationStation: "NDLS",
      departureTime: "14:30",
      arrivalTime: "22:05",
      duration: "7h 35m",
      runningDays: [1, 2, 3, 4, 5, 6],
      distance: 704,
    },
    {
      trainNumber: "12301",
      trainName: "HOWRAH RAJDHANI",
      trainType: "Rajdhani",
      sourceStation: "NDLS",
      destinationStation: "HWH",
      departureTime: "16:55",
      arrivalTime: "09:55",
      duration: "17h 00m",
      runningDays: [0, 1, 2, 3, 4, 5, 6],
      distance: 1451,
    },
    {
      trainNumber: "12302",
      trainName: "HOWRAH RAJDHANI",
      trainType: "Rajdhani",
      sourceStation: "HWH",
      destinationStation: "NDLS",
      departureTime: "14:05",
      arrivalTime: "10:05",
      duration: "20h 00m",
      runningDays: [0, 1, 2, 3, 4, 5, 6],
      distance: 1451,
    },
    {
      trainNumber: "12951",
      trainName: "MUMBAI RAJDHANI",
      trainType: "Rajdhani",
      sourceStation: "NDLS",
      destinationStation: "BCT",
      departureTime: "16:35",
      arrivalTime: "08:35",
      duration: "16h 00m",
      runningDays: [0, 1, 2, 3, 4, 5, 6],
      distance: 1384,
    },
    {
      trainNumber: "12952",
      trainName: "MUMBAI RAJDHANI",
      trainType: "Rajdhani",
      sourceStation: "BCT",
      destinationStation: "NDLS",
      departureTime: "17:40",
      arrivalTime: "08:35",
      duration: "14h 55m",
      runningDays: [0, 1, 2, 3, 4, 5, 6],
      distance: 1384,
    },
    {
      trainNumber: "12627",
      trainName: "KARNATAKA EXPRESS",
      trainType: "Superfast",
      sourceStation: "NDLS",
      destinationStation: "SBC",
      departureTime: "21:30",
      arrivalTime: "06:40",
      duration: "33h 10m",
      runningDays: [0, 1, 2, 3, 4, 5, 6],
      distance: 2444,
    },
    {
      trainNumber: "12628",
      trainName: "KARNATAKA EXPRESS",
      trainType: "Superfast",
      sourceStation: "SBC",
      destinationStation: "NDLS",
      departureTime: "19:20",
      arrivalTime: "05:00",
      duration: "33h 40m",
      runningDays: [0, 1, 2, 3, 4, 5, 6],
      distance: 2444,
    },
  ];

  try {
    await db.insert(trains).values(trainData).onConflictDoNothing();
    console.log(`Seeded ${trainData.length} trains`);
  } catch (error) {
    console.log("Trains may already exist, skipping...");
  }

  console.log("Seeding train stops for Bhopal Shatabdi...");

  // Seed route for Bhopal Shatabdi (12002)
  const routeData = [
    { trainNumber: "12002", stationCode: "NDLS", arrivalTime: null, departureTime: "06:00", haltMinutes: 0, stopNumber: 1, platform: "1", distanceKm: 0, dayOffset: 0 },
    { trainNumber: "12002", stationCode: "AGC", arrivalTime: "07:56", departureTime: "07:58", haltMinutes: 2, stopNumber: 2, platform: "1", distanceKm: 188, dayOffset: 0 },
    { trainNumber: "12002", stationCode: "GWL", arrivalTime: "09:02", departureTime: "09:05", haltMinutes: 3, stopNumber: 3, platform: "3", distanceKm: 306, dayOffset: 0 },
    { trainNumber: "12002", stationCode: "JHS", arrivalTime: "10:15", departureTime: "10:20", haltMinutes: 5, stopNumber: 4, platform: "1", distanceKm: 403, dayOffset: 0 },
    { trainNumber: "12002", stationCode: "BPL", arrivalTime: "13:35", departureTime: null, haltMinutes: 0, stopNumber: 5, platform: "1", distanceKm: 704, dayOffset: 0 },
  ];

  try {
    await db.insert(trainStops).values(routeData).onConflictDoNothing();
    console.log(`Seeded ${routeData.length} train stops`);
  } catch (error) {
    console.log("Train stops may already exist, skipping...");
  }

  console.log("Seed completed successfully!");

  await connection.end();
};

seedData().catch(console.error);
