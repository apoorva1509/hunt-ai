import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(process.cwd(), "..");

function parseYamlSimple(text: string): Record<string, string> {
  const sections: Record<string, string> = {};
  let currentKey = "";
  let currentLines: string[] = [];

  for (const line of text.split("\n")) {
    if (/^[a-z_]+:/.test(line)) {
      if (currentKey) sections[currentKey] = currentLines.join("\n").trim();
      currentKey = line.split(":")[0];
      const rest = line.slice(currentKey.length + 1).trim();
      currentLines = rest ? [rest] : [];
    } else {
      currentLines.push(line);
    }
  }
  if (currentKey) sections[currentKey] = currentLines.join("\n").trim();
  return sections;
}

function getField(text: string, key: string): string {
  const match = text.match(new RegExp(`${key}:\\s*"?([^"\\n]+)"?`));
  return match?.[1]?.trim() ?? "";
}

export async function GET() {
  const profilePath = path.join(ROOT, "config/profile.yml");
  const cvPath = path.join(ROOT, "cv.md");

  const profileRaw = fs.existsSync(profilePath)
    ? fs.readFileSync(profilePath, "utf-8")
    : "";
  const cvRaw = fs.existsSync(cvPath)
    ? fs.readFileSync(cvPath, "utf-8")
    : "";

  const sections = parseYamlSimple(profileRaw);
  const candidate = sections.candidate ?? "";
  const compensation = sections.compensation ?? "";
  const location = sections.location ?? "";
  const narrative = sections.narrative ?? "";

  return NextResponse.json({
    candidate: {
      full_name: getField(candidate, "full_name"),
      email: getField(candidate, "email"),
      phone: getField(candidate, "phone"),
      linkedin: getField(candidate, "linkedin"),
      github: getField(candidate, "github"),
      location: getField(candidate, "location"),
    },
    compensation: {
      current_ctc: getField(compensation, "current_ctc"),
      target_range: getField(compensation, "target_range"),
      minimum: getField(compensation, "minimum"),
      currency: getField(compensation, "currency"),
    },
    location: {
      city: getField(location, "city"),
      timezone: getField(location, "timezone"),
      visa_status: getField(location, "visa_status"),
      preference: getField(location, "preference"),
    },
    narrative: {
      headline: getField(narrative, "headline"),
      exit_story: getField(narrative, "exit_story"),
    },
    target_roles: sections.target_roles ?? "",
    cv: cvRaw,
  });
}
