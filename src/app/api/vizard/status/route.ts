import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VIZARD_API_KEY = process.env.VIZARD_API_KEY!;
const VIZARD_BASE_URL = "https://elb-api.vizard.ai/hvizard-server-front/open-api/v1";

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get("projectId");

        if (!projectId) {
            return NextResponse.json(
                { error: "נא לספק מזהה פרויקט" },
                { status: 400 }
            );
        }

        const response = await fetch(`${VIZARD_BASE_URL}/project/${projectId}`, {
            headers: {
                "VIZARDAI_API_KEY": VIZARD_API_KEY,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Vizard status error:", errorText);
            return NextResponse.json(
                { error: "שליפת סטטוס נכשלה" },
                { status: response.status }
            );
        }

        const data = await response.json();

        return NextResponse.json({
            success: true,
            status: data.status,
            clips: data.clips || data.data?.clips || [],
            progress: data.progress,
        });
    } catch (error: any) {
        console.error("Vizard status error:", error);
        return NextResponse.json(
            { error: error.message || "שליפת סטטוס נכשלה" },
            { status: 500 }
        );
    }
}