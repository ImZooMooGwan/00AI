import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { YouthPolicyAtlas } from "@/components/YouthPolicyAtlas";

export default function Home() {
  return (
    <div className="site-root atlas-root">
      <a className="skip-link" href="#main">본문 바로가기</a>
      <SiteHeader />
      <main id="main">
        <YouthPolicyAtlas />
      </main>
      <SiteFooter />
    </div>
  );
}
