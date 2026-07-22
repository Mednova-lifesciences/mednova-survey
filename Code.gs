const SPREADSHEET_ID = ""; // Optional: set spreadsheet ID for standalone script. Leave blank if using a bound script.
const SURVEY_SHEET_NAME = "MEDNOVA-SURVEY";
const LEADS_SHEET_NAME = "MEDNOVA-LEADS";

const SURVEY_HEADERS = [
  "Submission Time",
  "Role",
  "Organisation Type",
  "Location",
  "Years in Pharmacovigilance",
  "Functional PV System",
  "Designated QPPV",
  "PSMF Available",
  "Business Continuity & Data Collection Strategy",
  "Current Safety Tools",
  "Inspection Readiness Score",
  "Activities Giving the Most Trouble",
  "Biggest Barriers",
  "Biggest Pain Point",
  "Desired Services",
  "Preferred Engagement Model",
  "Decision Factors",
  "Preferred Training Topics",
  "Preferred Training Formats",
];

const LEADS_HEADERS = [
  "Submission Time",
  "Name",
  "Organisation",
  "Email",
  "WhatsApp",
  "Permission to Contact",
];

function doPost(e) {
  try {
    const payload = parseJsonRequest(e);
    const surveySheet = getOrCreateSheet(SURVEY_SHEET_NAME, SURVEY_HEADERS);
    const leadsSheet = getOrCreateSheet(LEADS_SHEET_NAME, LEADS_HEADERS);

    const surveyRow = buildSurveyRow(payload);
    surveySheet.appendRow(surveyRow);

    const leadRow = buildLeadRow(payload);
    if (leadRow) {
      leadsSheet.appendRow(leadRow);
    }

    return jsonResponse({ success: true });
  } catch (error) {
    return jsonResponse({
      success: false,
      error: String(error.message || error),
    });
  }
}

function parseJsonRequest(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error("No JSON payload found in the request.");
  }

  let payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (error) {
    throw new Error("Unable to parse JSON payload.");
  }

  if (typeof payload !== "object" || payload === null) {
    throw new Error("Payload must be a JSON object.");
  }

  return payload;
}

function getOrCreateSheet(name, headers) {
  const spreadsheet = SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();

  if (!spreadsheet) {
    throw new Error("Unable to access the target spreadsheet.");
  }

  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }

  ensureHeaders(sheet, headers);
  return sheet;
}

function ensureHeaders(sheet, headers) {
  const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const hasHeader = firstRow.some((cell) => String(cell || "").trim() !== "");

  if (!hasHeader) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

function buildSurveyRow(payload) {
  return [
    safeString(payload.submitted_at),
    safeString(payload.role),
    safeString(payload.org),
    safeString(payload.location),
    safeString(payload.years),
    safeString(payload.system),
    safeString(payload.qppv),
    safeString(payload.psmf),
    safeString(payload.quality_bcp),
    arrayToCsv(payload.tools),
    safeString(payload.readiness),
    arrayToCsv(payload.activities),
    arrayToCsv(payload.barriers),
    safeString(payload.biggest_pain),
    arrayToCsv(payload.services),
    safeString(payload.engagement),
    safeString(payload.decision_factors),
    arrayToCsv(payload.training_topics),
    arrayToCsv(payload.training_format),
  ];
}

function buildLeadRow(payload) {
  const contact = payload.contact || {};
  const email = safeString(contact.email);
  if (!email) {
    return null;
  }

  return [
    safeString(payload.submitted_at),
    safeString(contact.name),
    safeString(contact.organisation),
    email,
    safeString(contact.whatsapp),
    safeString(contact.permission),
  ];
}

function safeString(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function arrayToCsv(value) {
  if (!Array.isArray(value)) {
    return safeString(value);
  }
  return value
    .map((item) => safeString(item))
    .filter((item) => item !== "")
    .join(", ");
}

function jsonResponse(responseObject) {
  return ContentService.createTextOutput(
    JSON.stringify(responseObject),
  ).setMimeType(ContentService.MimeType.JSON);
}
