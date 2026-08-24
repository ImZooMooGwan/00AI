import { YouthPolicyAtlas } from "@/components/YouthPolicyAtlas";

export default function Home() {
  return (
    <div className="galaxy-page-root">
      <a className="skip-link" href="#main">본문 바로가기</a>
      <main id="main">
        <YouthPolicyAtlas />
      </main>
    </div>
  );
}
