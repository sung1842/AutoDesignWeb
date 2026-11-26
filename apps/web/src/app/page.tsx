// S01 랜딩(01장 1.5.1, AC-00-03): 카피는 copy/ko.ts.
import { KO } from "../copy/ko";
import { StartButton } from "./start-button";

export default function Home() {
  return (
    <main className="svc-wrap">
      <p className="svc-muted">취향핏</p>
      <h1 className="svc-display" style={{ fontSize: 40 }}>
        {KO["landing.headline"]}
      </h1>
      <p>{KO["landing.sub"]}</p>
      <p className="svc-muted">{KO["landing.meta"]}</p>
      <StartButton />
    </main>
  );
}
