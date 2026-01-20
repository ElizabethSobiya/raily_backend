export const API_VERSION = process.env.API_VERSION || "v1";

export const TRAIN_TYPES = {
  RAJDHANI: "Rajdhani",
  SHATABDI: "Shatabdi",
  DURONTO: "Duronto",
  VANDE_BHARAT: "Vande Bharat",
  SUPERFAST: "Superfast",
  EXPRESS: "Express",
  MAIL: "Mail",
  PASSENGER: "Passenger",
  LOCAL: "Local",
  GARIB_RATH: "Garib Rath",
  JAN_SHATABDI: "Jan Shatabdi",
  HUMSAFAR: "Humsafar",
  TEJAS: "Tejas",
} as const;

export const COACH_TYPES = {
  "1A": "First AC",
  "2A": "AC 2 Tier",
  "3A": "AC 3 Tier",
  "3E": "AC 3 Economy",
  SL: "Sleeper",
  CC: "AC Chair Car",
  EC: "Executive Chair Car",
  "2S": "Second Sitting",
  GN: "General",
} as const;

export const BOOKING_STATUS = {
  CNF: "Confirmed",
  RAC: "RAC",
  WL: "Waiting List",
  RLWL: "Remote Location Waiting List",
  PQWL: "Pooled Quota Waiting List",
  GNWL: "General Waiting List",
  REGRET: "Regret",
} as const;

export const TRIP_STATUS = {
  UPCOMING: "upcoming",
  LIVE: "live",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export const NOTIFICATION_TYPES = {
  DELAY_ALERT: "delay_alert",
  PLATFORM_CHANGE: "platform_change",
  ARRIVAL_REMINDER: "arrival_reminder",
  DEPARTURE_REMINDER: "departure_reminder",
  PNR_UPDATE: "pnr_update",
  TRAIN_CANCELLED: "train_cancelled",
} as const;

export const INDIAN_RAILWAY_ZONES = {
  CR: "Central Railway",
  ER: "Eastern Railway",
  ECR: "East Central Railway",
  ECoR: "East Coast Railway",
  NR: "Northern Railway",
  NCR: "North Central Railway",
  NER: "North Eastern Railway",
  NFR: "Northeast Frontier Railway",
  NWR: "North Western Railway",
  SR: "Southern Railway",
  SCR: "South Central Railway",
  SER: "South Eastern Railway",
  SECR: "South East Central Railway",
  SWR: "South Western Railway",
  WR: "Western Railway",
  WCR: "West Central Railway",
  KRCL: "Konkan Railway",
  METRO: "Metro Railway",
} as const;

export const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;
