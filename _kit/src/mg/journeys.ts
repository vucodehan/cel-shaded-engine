/**
 * Common biblical routes as place ids and [lon, lat] waypoints, for Route.via. Sea legs go through open-water
 * waypoints so a straight leg never cuts across land. Routes marked `approx` follow a traditional reconstruction
 * (the Exodus, Abraham's road): keep their labels modest. Use { via: JOURNEYS.paul1, p, smooth: true }.
 */
import { LL } from "./places";

type Via = (string | LL)[];

export const JOURNEYS: Record<string, Via> = {
  /** Genesis 11-12: Ur up the Euphrates to Haran, then south to Shechem and Bethel (approx). */
  abraham: ["ur", "erech", "babylon", [42.3, 34.2], "mari", [39.6, 35.9], "haran", "carchemish", [37.2, 35.6], "hamath", "damascus", "hazor", "shechem", "bethel"],
  /** Exodus 12-19, Numbers 20-21, Deuteronomy 34 (traditional southern route, approx). */
  exodus: ["rameses", "pithom", [32.45, 30.15], [32.75, 29.6], [33.1, 29.15], [33.55, 28.8], "sinai", [34.3, 29.4], "kadesh", "ezion_geber", [35.6, 30.2], [36.0, 31.0], "dibon", "nebo"],
  /** Matthew 2: Bethlehem to Egypt and back to Nazareth (along the coast road). */
  flight_egypt: ["bethlehem", "hebron", "gaza", [33.2, 31.1], [32.3, 31.0], "zoan", "on"],
  return_nazareth: ["on", "zoan", [32.3, 31.0], [33.2, 31.1], "gaza", "joppa", "caesarea", "megiddo", "nazareth"],
  /** 2 Kings 25: Jerusalem to Babylon round the Fertile Crescent. */
  exile: ["jerusalem", "shechem", "hazor", "damascus", "hamath", [37.7, 36.1], [38.6, 35.95], [40.0, 35.3], "mari", [42.6, 33.9], "babylon"],
  /** Acts 13-14: Paul's first journey (Antioch to Derbe and back by sea). */
  paul1: ["antioch", "seleucia", "salamis", "paphos", "perga", "pisidian_antioch", "iconium", "lystra", "derbe"],
  paul1_return: ["derbe", "lystra", "iconium", "pisidian_antioch", "perga", "attalia", [33.6, 36.0], "seleucia", "antioch"],
  /** Acts 15:36-18:22: second journey. */
  paul2: ["antioch", [36.2, 36.9], "tarsus", [34.2, 37.3], "derbe", "lystra", "iconium", "pisidian_antioch", [30.6, 38.95], [28.6, 39.95], "troas",
    "samothrace", "neapolis", "philippi", "amphipolis", "apollonia", "thessalonica", "berea", [22.62, 40.3], [23.5, 39.7], [24.75, 38.6], [24.25, 37.72],
    "athens", "corinth", "cenchreae", [24.3, 37.55], [25.6, 37.6], [26.6, 37.9], "ephesus", [26.9, 37.2], [27.6, 36.5], [28.6, 35.95], [30.6, 35.6],
    [32.2, 34.4], "caesarea", "jerusalem"],
  /** Acts 18:23-21:17: third journey, ending by sea to Caesarea and up to Jerusalem. */
  paul3: ["antioch", [36.2, 36.9], "tarsus", [34.2, 37.3], "derbe", "lystra", "iconium", "pisidian_antioch", [30.6, 38.95], "laodicea", "ephesus",
    "troas", "neapolis", "philippi", "thessalonica", "berea", [22.4, 39.2], "corinth", [22.4, 39.2], "berea", "thessalonica", "philippi", "neapolis",
    "troas", "assos", "mitylene", [26.3, 38.6], [26.75, 37.75], "miletus", "cos", "rhodes", "patara", [31.0, 35.2], [33.3, 34.35], "tyre",
    [35.08, 32.92], "caesarea", "jerusalem"],
  /** Acts 27-28: the voyage to Rome, shipwreck on Malta. */
  paul_rome: ["caesarea", "sidon", [34.4, 35.75], [32.0, 36.15], "myra", [28.4, 36.4], [27.37, 36.6], [26.4, 35.15], "fair_havens", [24.08, 34.75],
    [20.0, 35.1], "malta", "syracuse", "rhegium", "puteoli", "rome"],
  /** Jonah 1: Joppa toward Tarshish (the far west). */
  jonah: ["joppa", [33.5, 33.0], [29.0, 33.6], [22.0, 34.2], [16.0, 36.2], [10.5, 37.6], [3.0, 37.4], [-5.0, 36.0], "tarshish"],
};
