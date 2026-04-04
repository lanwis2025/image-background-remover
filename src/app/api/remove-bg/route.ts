import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get("image") as File | null;

    if (!imageFile) {
      return NextResponse.json({ error: "请上传图片文件" }, { status: 400 });
    }

    // 格式校验
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(imageFile.type)) {
      return NextResponse.json(
        { error: "请上传 JPG/PNG/WebP 格式图片" },
        { status: 400 }
      );
    }

    // 大小校验 10MB
    if (imageFile.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "图片大小不能超过 10MB" },
        { status: 400 }
      );
    }

    const apiKey = process.env.REMOVE_BG_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "服务配置错误，请联系管理员" },
        { status: 500 }
      );
    }

    // 转发给 remove.bg
    const rb = new FormData();
    rb.append("image_file", imageFile);
    rb.append("size", "auto");

    const response = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
      },
      body: rb,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("remove.bg error:", errText);
      return NextResponse.json(
        { error: "处理失败，请稍后重试" },
        { status: 500 }
      );
    }

    const resultBuffer = await response.arrayBuffer();

    return new NextResponse(resultBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": 'attachment; filename="removed-bg.png"',
      },
    });
  } catch (err) {
    console.error("API error:", err);
    return NextResponse.json(
      { error: "请求超时，请检查网络后重试" },
      { status: 500 }
    );
  }
}
