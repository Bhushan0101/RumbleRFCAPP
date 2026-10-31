// OpenNext configuration for Cloudflare Workers.
// https://opennext.js.org/cloudflare
//
// This app is fully dynamic (auth-gated + DB on every request) so we don't
// configure incremental cache / tag cache / queues. Add later if we introduce
// ISR or background revalidation.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
