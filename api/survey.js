const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);
const REQUIRED_FIELDS = ["role", "org", "system", "readiness", "services", "biggest_pain"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(value) {
  return typeof value === "string" && EMAIL_REGEX.test(value.trim());
}

function buildContactSection(payload) {
  return {
    name: (payload.contact_name || "").trim(),
    organisation: (payload.contact_org || "").trim(),
    email: (payload.contact_email || "").trim(),
    whatsapp: (payload.contact_whatsapp || "").trim(),
    permission: (payload.may_contact || "").trim()
  };
}

function buildPlainContactMessage(contact) {
  return [
    `Name: ${contact.name || "(not provided)"}`,
    `Organisation: ${contact.organisation || "(not provided)"}`,
    `Email: ${contact.email}`,
    `WhatsApp: ${contact.whatsapp || "(not provided)"}`,
    `Permission to contact: ${contact.permission || "(not provided)"}`
  ].join("\n");
}

function buildHtmlContactMessage(contact) {
  return `
    <div style="font-family:Inter,system-ui,sans-serif;color:#12211C;line-height:1.6">
      <h2 style="margin:0 0 16px;color:#1E7F7A;font-size:20px">New Pharmacovigilance Survey Lead</h2>
      <p style="margin:0 0 22px;color:#3E5A48;font-size:14px">The respondent shared contact details in the optional section.</p>
      <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;color:#1D2A24">
        <tr><td style="padding:8px 0;font-weight:600;width:180px">Name</td><td style="padding:8px 0">${contact.name || "(not provided)"}</td></tr>
        <tr><td style="padding:8px 0;font-weight:600">Organisation</td><td style="padding:8px 0">${contact.organisation || "(not provided)"}</td></tr>
        <tr><td style="padding:8px 0;font-weight:600">Email</td><td style="padding:8px 0">${contact.email}</td></tr>
        <tr><td style="padding:8px 0;font-weight:600">WhatsApp</td><td style="padding:8px 0">${contact.whatsapp || "(not provided)"}</td></tr>
        <tr><td style="padding:8px 0;font-weight:600">Permission to contact</td><td style="padding:8px 0">${contact.permission || "(not provided)"}</td></tr>
      </table>
    </div>
  `;
}

function buildConfirmationEmailHtml(contact) {
  return `
    <div style="margin:0;padding:0;font-family:Inter,system-ui,sans-serif;color:#12211C;background:#F6F4ED">
      <table role="presentation" width="100%" style="max-width:640px;margin:0 auto;background:#FFFFFF;border-radius:18px;overflow:hidden;box-shadow:0 24px 60px rgba(18,33,28,.08)">
        <tr style="background:linear-gradient(180deg,#1E7F7A,#2AA39C);color:#fff">
          <td style="padding:28px 24px;text-align:center">
            <p style="margin:0;font-size:13px;letter-spacing:.18em;text-transform:uppercase;opacity:.85">MedNova Lifesciences</p>
            <h1 style="margin:10px 0 0;font-size:26px;line-height:1.1">Thank you for completing the MedNova Pharmacovigilance Survey</h1>
          </td>
        </tr>
        <tr><td style="padding:28px 24px">
          <p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#1D2A24">Hi ${contact.name || "there"},</p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#3E5A48">Thank you for taking the time to share your perspectives in the Pharmacovigilance survey. Your responses have been received and will help shape how MedNova supports PV teams in Nigeria.</p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#3E5A48">Because you provided contact details, we may follow up if you asked us to contact you about the findings or your PV needs.</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#3E5A48">Once the survey closes, we may also share an aggregate summary of the findings with contributors.</p>
          <div style="background:#F6F4ED;border:1px solid #E2DED2;border-radius:14px;padding:18px;margin-bottom:24px;font-size:14px;color:#1D2A24;line-height:1.7">
            <strong style="display:block;margin-bottom:10px;color:#12211C">What happens next</strong>
            <ul style="margin:0;padding-left:18px">
              <li>We will review the survey responses.</li>
              <li>MedNova may reach out if you requested contact.</li>
              <li>We may share a high-level summary after the survey closes.</li>
            </ul>
          </div>
          <p style="margin:0;font-size:15px;line-height:1.7;color:#3E5A48">If you have any urgent questions, please reply to this email once our team reaches out.</p>
        </td></tr>
        <tr style="background:#12211C;color:#fff">
          <td style="padding:20px 24px;text-align:center;font-size:13px;line-height:1.7">
            MedNova Lifesciences · Pharmacovigilance & Regulatory · Lagos, Nigeria
          </td>
        </tr>
      </table>
    </div>
  `;
}

function formatError(err) {
  try {
    const out = {
      name: err && err.name,
      message: err && err.message,
      stack: err && err.stack
    };
    // If error has a response body (e.g. fetch/Resend), try to include it
    if (err && err.response && typeof err.response.text === 'function') {
      // can't await here; include a placeholder
      out.response = '(response object present)';
    } else if (err && err.response) {
      out.response = err.response;
    }
    return out;
  } catch (e) {
    return { error: 'Failed to format error', original: String(err) };
  }
}

function validatePayload(payload) {
  if (typeof payload !== "object" || payload === null) {
    return "Invalid request body";
  }

  for (const field of REQUIRED_FIELDS) {
    const value = payload[field];
    if (field === "services") {
      if (!Array.isArray(value) || value.length === 0) {
        return `Missing required field: ${field}`;
      }
    } else {
      if (!value || String(value).trim() === "") {
        return `Missing required field: ${field}`;
      }
    }
  }

  if (payload.contact_email && !isValidEmail(payload.contact_email)) {
    return "Invalid contact email format";
  }

  return null;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL || !process.env.NOTIFICATION_EMAIL || !process.env.GOOGLE_SCRIPT_URL) {
    return res.status(500).json({ error: "Server configuration is incomplete." });
  }

  let payload = req.body;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch (error) {
      return res.status(400).json({ error: "Invalid JSON payload" });
    }
  }

  const validationError = validatePayload(payload);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  // --- Diagnostic logging: incoming payload and env presence ---
  console.log("Survey received");
  console.log("Payload (raw):", JSON.stringify(payload));
  console.log("Payload.contact (if present):", JSON.stringify(payload.contact || null));
  console.log({
    hasResendKey: !!process.env.RESEND_API_KEY,
    hasFromEmail: !!process.env.FROM_EMAIL,
    hasNotificationEmail: !!process.env.NOTIFICATION_EMAIL,
    hasGoogleScript: !!process.env.GOOGLE_SCRIPT_URL
  });

  const contact = buildContactSection(payload);
  console.log("Built contact object:", JSON.stringify(contact));
  const hasContactEmail = isValidEmail(contact.email);
  console.log("Has contact email:", hasContactEmail);
  const sheetPayload = {
    ...payload,
    contact,
    submitted_at: new Date().toISOString()
  };

  try {
    const googleResponse = await fetch(process.env.GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sheetPayload)
    });

    if (!googleResponse.ok) {
      const errorText = await googleResponse.text().catch(() => "");
      throw new Error(`Google Sheets submission failed: ${googleResponse.status} ${errorText}`);
    }

    if (hasContactEmail) {
      console.log("Sending notification email to internal team:", process.env.NOTIFICATION_EMAIL);
      try {
        const notifResp = await resend.emails.send({
          from: process.env.FROM_EMAIL,
          to: process.env.NOTIFICATION_EMAIL,
          subject: "New Pharmacovigilance Survey Lead",
          text: buildPlainContactMessage(contact),
          html: buildHtmlContactMessage(contact)
        });
        console.log("Notification email response:", JSON.stringify(notifResp));
      } catch (err) {
        console.error("Notification email error:", formatError(err));
        throw err;
      }

      console.log("Sending confirmation email to respondent:", contact.email);
      try {
        const confirmResp = await resend.emails.send({
          from: process.env.FROM_EMAIL,
          to: contact.email,
          subject: "Thank You for Completing the MedNova Pharmacovigilance Survey",
          html: buildConfirmationEmailHtml(contact)
        });
        console.log("Confirmation email response:", JSON.stringify(confirmResp));
      } catch (err) {
        console.error("Confirmation email error:", formatError(err));
        throw err;
      }
    } else {
      console.log("No contact email provided; skipping email send.");
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || "Submission failed." });
  }
};
