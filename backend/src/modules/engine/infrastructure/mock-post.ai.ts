import { draftPost } from "../domain/post-drafts";
import {
  BrandAiInput,
  BrandAiResult,
  PostAi,
  PostAiInput,
  PostAiResult,
} from "../domain/ports/post-ai";

export class MockPostAi implements PostAi {
  readonly calls: PostAiInput[] = [];
  readonly brandCalls: BrandAiInput[] = [];

  async write(_apiKey: string, input: PostAiInput): Promise<PostAiResult> {
    this.calls.push(input);
    return draftPost(input);
  }

  async brandKit(_apiKey: string, input: BrandAiInput): Promise<BrandAiResult> {
    this.brandCalls.push(input);
    const text = `${input.websiteText}\n${input.recentCaptions.join("\n")}`;
    const dental = /dental|dentist|teeth|smile/i.test(text);
    const city = /\bPatna\b/i.test(text) ? "Patna" : null;
    return {
      businessType: dental ? "Dental clinic" : "Local business",
      audience: dental
        ? "families and working professionals who want painless dental care"
        : "people nearby looking for trusted local services",
      voice: "friendly",
      topics: dental
        ? [
            "oral hygiene tips",
            "braces and aligners",
            "kids' dental care",
            "painless treatments",
          ]
        : ["tips", "our services", "customer stories"],
      offers: dental
        ? ["Free check-up for children under 12", "10% off teeth whitening"]
        : [],
      hashtags: dental
        ? ["dentist", "dentalcare", "smile", "oralhealth"]
        : ["smallbusiness", "local"],
      cta: dental ? "Book an appointment" : "Message us",
      city,
    };
  }
}
