import { Phone, MessageCircle, Mail, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const CONTACTS = [
  { label: "Primary Line", number: "+254717434943", href: "tel:+254717434943" },
  { label: "Secondary Line", number: "+254781585319", href: "tel:+254781585319" },
];

const TIKTOK_URL = "https://tiktok.com/@pesamatrixsignals";
const WHATSAPP_NUMBER = "254717434943";

export default function ContactPage() {
  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Contact Us</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Reach out through any of the channels below
        </p>
      </div>

      {/* Phone numbers */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="size-4 text-primary" />
            Phone Numbers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {CONTACTS.map((c) => (
            <a
              key={c.number}
              href={c.href}
              className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors group"
            >
              <div>
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                  {c.number}
                </p>
              </div>
              <Phone className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </a>
          ))}
        </CardContent>
      </Card>

      {/* WhatsApp */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="size-4 text-green-400" />
            WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent>
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-green-500/50 hover:bg-green-500/5 transition-colors group"
          >
            <div>
              <p className="text-xs text-muted-foreground">Chat with us on WhatsApp</p>
              <p className="text-sm font-semibold text-foreground group-hover:text-green-400 transition-colors">
                +{WHATSAPP_NUMBER}
              </p>
            </div>
            <div
              className="size-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "#25D366" }}
            >
              <svg viewBox="0 0 24 24" className="size-4 fill-white">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </div>
          </a>
        </CardContent>
      </Card>

      {/* TikTok */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="size-4 fill-current text-foreground">
              <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.27 8.27 0 004.84 1.55V6.79a4.85 4.85 0 01-1.07-.1z" />
            </svg>
            TikTok
          </CardTitle>
        </CardHeader>
        <CardContent>
          <a
            href={TIKTOK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors group"
          >
            <div>
              <p className="text-xs text-muted-foreground">Follow us on TikTok</p>
              <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                @pesamatrixsignals
              </p>
            </div>
            <svg viewBox="0 0 24 24" className="size-5 fill-muted-foreground group-hover:fill-primary transition-colors">
              <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.27 8.27 0 004.84 1.55V6.79a4.85 4.85 0 01-1.07-.1z" />
            </svg>
          </a>
        </CardContent>
      </Card>

      {/* Info note */}
      <p className="text-xs text-muted-foreground text-center">
        We're available Monday–Friday, 8am–6pm EAT. Expect a response within 2 hours.
      </p>
    </div>
  );
}
