import { loadConfig } from "../config.js";
import { openDatabase } from "./db.js";

const config = loadConfig();
openDatabase(config.databasePath);
console.log(`Migrations applied to ${config.databasePath}`);
