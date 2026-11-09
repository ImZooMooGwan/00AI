# 00AI COUNCIL web deployment

## Current deployment

- Public URL: https://council.00ai.kr/
- Cloudflare Worker: `00ai-council`
- Route: `council.00ai.kr/*`
- D1 database: `00ai-council-main`
- Login: 00AI COUNCIL-branded passwordless email code using the existing 00AI NOTE auth service (`auth@00ai.kr`); only `@korea.kr` addresses are accepted
- Broadcast source: Daejeon Metropolitan Council official live page
- Korean speech recognition: Cloudflare Workers AI Whisper Large V3 Turbo, `language=ko`, in 6-second WAV chunks
- Draft report: Cloudflare Workers AI Llama 3.3

The Council Worker and its D1 database are isolated from the existing 00AI portal, ATS, and HASA Workers. Council calls the existing 00AI NOTE Worker through a Cloudflare service binding for code request and verification. Duplicate-code cooldown responses are treated as an already-issued code so the user can proceed to enter the original email code., then creates its own 12-hour opaque session. No mail credentials are duplicated in Council.

## User flow

1. Open `https://council.00ai.kr/`, enter a `@korea.kr` address, and request the one-time code from 00AI. The sender is `auth@00ai.kr` and the login screen is branded 00AI COUNCIL.
2. 공식 생방송 화면에서 ON-AIR 채널을 선택합니다. 화면 폭을 넓혀 방송과 회의 정보를 한 화면에서 볼 수 있도록 구성했습니다.
3. Select **현재 영상 연결·한글 자막 시작**. 수동 회의 직접 등록 메뉴는 제거했으며, 이 버튼이 현재 로그인 사용자의 회의를 자동으로 만들거나 진행 중인 회의에 연결합니다. The browser share dialog must be approved; choose the `Microsoft Edge 탭` entry for the current Council page and enable tab audio. Browser security does not permit a website to choose or record a tab silently.
4. The app reuses the user’s active live meeting or creates one, then starts Korean transcription automatically. Captions are finalized in approximately 6-second chunks, saved to the meeting record, and can be downloaded as TXT.
5. Authenticated `@korea.kr` users can send and read meeting chat messages using automatically assigned Dream-seed character nicknames; updates appear within about 2 seconds. The meeting creator controls meeting state.
6. Generate the report after the meeting and verify it against the official recording, official minutes, and source documents.

The browser requires an explicit user gesture and tab-audio sharing permission. It cannot silently start capture or determine which ON-AIR committee is relevant. Original audio is streamed to the configured recognition provider and is not stored by this app; transcript segments, comments, meeting data, and report drafts are stored in D1.

## Source review and safeguards

- 로그인 화면은 00AI COUNCIL 브랜드를 사용하고 이메일 코드 발급·검증을 기존 00AI NOTE 인증 API에 서버 간 요청으로 전달합니다. 검증 성공 뒤 Council에서 12시간 세션을 발급하며 D1에는 세션 토큰의 SHA-256 해시만 저장합니다. 이메일은 `@korea.kr` 도메인만 허용합니다. 로그아웃 시 해당 세션 해시를 삭제합니다.
- 회의 상세 내역과 보고서 입력은 최대 4,000개 자막 구간을 읽습니다. 보고서 입력이 상한에 도달하면 결과에 범위 제한을 표시합니다. 4,000구간을 넘는 장시간·연속 회의는 별도 페이지네이션 개선이 필요합니다.
- 음성 전사 요청은 30초 제한과 동일 구간 ID 기반 1회 재시도를 사용합니다. 재시도 후 실패한 구간은 화면에 오류로 표시하지만 자동 복구되지는 않습니다.
- 브라우저는 명시적인 화면 공유와 탭 오디오 승인을 요구합니다. 공유창에서 현재 Council 페이지 탭과 탭 오디오를 선택해야 합니다. 방송 페이지/브라우저가 탭 오디오 공유를 제공하지 않는 환경에서는 자막 입력을 받을 수 없습니다.
- 전사는 약 6초 구간 단위로 처리되며 단어 단위 실시간 스트리밍은 아닙니다. 한 구간의 Whisper 처리 지연에 따라 표시 간격이 늘 수 있습니다.
- 실시간 fact-check, HASA 연결, 화자 식별, 대화형 수정 이력은 현재 배포본에 포함되어 있지 않습니다. 보고서의 근거 표시는 전사문 위치이며 사실 검증 결과가 아닙니다.

## Scope and remaining integration

- This is the dedicated web application for the requested hostname. The source of the private root portal Worker was not changed, so adding a service tile to the `00ai.kr` homepage remains separate work.
- Council no longer uses a Cloudflare Access login page. Account verification is delegated to the existing 00AI NOTE email-code service. Domain validation restricts sign-in to `@korea.kr`, which does not independently prove current employment or provide role-based identity proof.
- Existing 00AI/HASA is not wired into this deployment. Live speech recognition and report drafting currently use Cloudflare Workers AI. The existing HASA credential is not copied or exposed. Integrate through an approved service binding or API once the exact non-secret interface contract is available.

- The native Windows Stream-Record application is not installed on Cloudflare. Its source remains useful for desktop recording and post-processing; browser audio capture uses a separate web implementation.
- A complete authenticated live-session test against an active Council broadcast is still pending. The deployment captures audio from the currently displayed Council tab after browser permission, forces Korean transcription, stores chunks as meeting minutes, and adds character nicknames to chat. Validate real speech recognition and report quality with an eligible `@korea.kr` session and tab-audio permission.

## Deployment resources

- Worker script: `00ai-council`
- Worker deployment: deployment `a56283ecae8046b495f37e74d6523a12` deployed 2026-11-09
- D1 database ID: `98031fe6-f280-4b33-a239-e76247215d7b`
- Cloudflare Access application: removed for this hostname; the Council Worker enforces the 00AI OTP session on every app API.

Do not put API keys, Access tokens, or user session tokens in this repository.
