# Figma 디자인 검토본

Figma 파일: https://www.figma.com/design/f2X1FjxpCxKXTZG2k9hHQ7

주요 페이지:

- `Foundations`: 색상·타입·레이아웃·효과 토큰
- `Components / Controls`: Command Button, Mode Segment, Status Badge
- `Components / Pipeline`: Pipeline Node
- `Components / Intelligence`: KPI Tile, Policy Option, Evidence Card
- `Components / Budget`: Budget Control (Default / Compact)
- `Prototype / Desktop`: Future Command Center
- `Prototype / Mobile`: 모바일 정책 흐름
- `Motion Spec`: 4초 반복 정책 결정 루프

모션은 시그널 오비트, Decision Core 호흡, 파이프라인·KPI·근거 카드 순차 등장으로 구성되어 있습니다. 웹 구현에서는 `styles.css`의 `@keyframes`와 `app.js`의 진행 상태 로직을 함께 참고하면 됩니다.
