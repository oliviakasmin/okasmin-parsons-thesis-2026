import { Anatomy, CaseStudies, Intro, Intro2, ShelfContainer, Title } from "./Components";

export default function MainHomeShell() {
  return (
    <main>
      <div style={{ display: "grid", gap: "4rem" }}>
        <Title />
        <Intro />
        <Anatomy />
        <Intro2 />
        <ShelfContainer />
        <CaseStudies />
      </div>
    </main>
  );
}
