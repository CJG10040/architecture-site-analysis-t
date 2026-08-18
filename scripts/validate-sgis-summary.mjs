import { fetchSgisCensusSummary } from "../server/lib/dataAdapters.ts";

const result = await fetchSgisCensusSummary({ pnu: "2911010800100010000" });
console.log(JSON.stringify({ status: result.status, administrativeCode: result.data.administrativeCode, populationRows: Array.isArray(result.data.population) ? result.data.population.length : 0, householdRows: Array.isArray(result.data.household) ? result.data.household.length : 0, companyRows: Array.isArray(result.data.company) ? result.data.company.length : 0 }));
