import { supabase } from "@/integrations/supabase/client";

async function getClientIP(): Promise<string> {
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    const data = await res.json();
    return data.ip || "unknown";
  } catch {
    return "unknown";
  }
}

export async function isIPBanned(): Promise<{ banned: boolean; reason?: string }> {
  try {
    const ip = await getClientIP();
    if (ip === "unknown") return { banned: false };
    
    const { data } = await supabase.rpc("is_ip_banned" as any, { _ip_address: ip });
    
    if (data && data.length > 0 && data[0].banned) {
      return { banned: true, reason: data[0].reason || undefined };
    }
    
    return { banned: false };
  } catch (error) {
    console.error("IP ban check error:", error);
    return { banned: false };
  }
}

export async function recordRegistrationAttempt(ip: string, success: boolean) {
  try {
    await supabase.rpc("record_registration_attempt" as any, { _ip_address: ip, _success: success });
  } catch (error) {
    console.error("Failed to record registration attempt:", error);
  }
}
