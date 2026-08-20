import { NextResponse } from "next/server";

type RequestBody = { request?: string; audience?: string; deadline?: string };

function clean(value: unknown, limit: number) {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, limit) : "";
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as RequestBody;
    const task = clean(body.request, 800);
    const audience = clean(body.audience, 120) || "중앙부처";
    const deadline = clean(body.deadline, 40) || "미정";
    if (task.length < 10) return NextResponse.json({ error: "요청 내용을 10자 이상 입력해 주세요." }, { status: 400 });

    return NextResponse.json({
      mode: "local_first",
      externalDataPolicy: "internal_data_never_leaves_network",
      taskAbstract: `대상: ${audience}; 마감: ${deadline}; 요청: ${task}`,
      externalPlannerInput: "개인정보·기관 내부문서·원문 데이터 없이, 필요한 자료 유형과 문서 목차만 설계합니다.",
      mcp: {
        required: true,
        tools: ["internal.document.search", "internal.data.query", "internal.template.render", "internal.approval.request"],
      },
      localExecutionPlan: [
        "권한과 업무 범위를 확인한다.",
        "행정망 내부 MCP로 기존 공문·보고서·통계 자료를 검색한다.",
        "검색 결과를 근거 단위로 정리하고 누락 항목을 표시한다.",
        "기관 양식에 맞춰 초안을 생성하고 담당자 검토를 요청한다.",
      ],
      humanApprovalRequired: true,
    });
  } catch {
    return NextResponse.json({ error: "업무 계획을 만들지 못했습니다." }, { status: 400 });
  }
}
