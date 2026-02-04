export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: generation } = await supabaseAdmin
        .from("generations")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

    if (!generation) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Already completed?
    if (generation.status === "completed") {
        return NextResponse.json({
            status: "completed",
            images: generation.result_urls,
        });
    }

    if (generation.status === "failed") {
        return NextResponse.json({ status: "failed", error: generation.metadata?.error });
    }

    // Check FAL status
    const falRequestId = generation.metadata?.fal_request_id;
    if (!falRequestId) {
        return NextResponse.json({ status: "processing" });
    }

    try {
        const statusRes = await fetch(
            `https://queue.fal.run/fal-ai/stable-diffusion-v15/requests/${falRequestId}/status`,
            { headers: { "Authorization": `Key ${process.env.FAL_KEY}` } }
        );
        const status = await statusRes.json();

        console.log("FAL Status:", status);

        if (status.status === "COMPLETED") {
            // Get result
            const resultRes = await fetch(
                `https://queue.fal.run/fal-ai/stable-diffusion-v15/requests/${falRequestId}`,
                { headers: { "Authorization": `Key ${process.env.FAL_KEY}` } }
            );
            const result = await resultRes.json();

            const images = result.images?.map((img: any) => img.url) || [];

            // Update database
            await supabaseAdmin
                .from("generations")
                .update({
                    status: "completed",
                    result_urls: images,
                    thumbnail_url: images[0],
                })
                .eq("id", id);

            return NextResponse.json({ status: "completed", images });
        }

        if (status.status === "FAILED") {
            await supabaseAdmin
                .from("generations")
                .update({ status: "failed" })
                .eq("id", id);
            return NextResponse.json({ status: "failed" });
        }

        return NextResponse.json({ status: "processing" });

    } catch (error) {
        return NextResponse.json({ status: "processing" });
    }
}