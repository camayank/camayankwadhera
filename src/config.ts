// Site-wide settings that change between environments.
//
// ENQUIRY_ENDPOINT: the Web app URL of the intake script (work-desk/intake.gs).
// Set PUBLIC_ENQUIRY_ENDPOINT on the host (or in a local .env file). While it is
// empty, the enquiry form only previews where an enquiry would be routed.
export const ENQUIRY_ENDPOINT: string = import.meta.env.PUBLIC_ENQUIRY_ENDPOINT ?? "";
