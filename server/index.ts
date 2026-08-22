import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const here = path.dirname(fileURLToPath(import.meta.url));
const staticRoot = path.join(here, "public");

app.use(express.static(staticRoot));
app.get("*", (_request, response) => response.sendFile(path.join(staticRoot, "index.html")));
app.listen(process.env.PORT || 3000, () => console.log("Static site preview is ready."));
