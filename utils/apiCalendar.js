import fetch from "node-fetch";
import config from "../bot/config.js";

/**
 * Ruft die MeetStr-API für bevorstehende Events ab.
 * @param {string} from ISO-Startdatum z.B. '2025-07-09'
 * @param {string} to   ISO-Enddatum   z.B. '2025-08-09'
 */
export async function fetchMeetupsFromAPI(from, to) {
  const url = `${config.MEETSTR_API_URL}?from=${from}&to=${to}`;
  console.log(url);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API-Fehler: ${res.status}`);
  }
  const json = await res.json();
  return json; // Array von Event-Objekten
}
