// web 기동 전 env 검증(06장 6.13.2, AC-06-32). 실패 시 변수명 출력 + 종료 코드 1.
import { findRepoRoot, loadEnvOrExit, withDotenv } from "@tastefit/config";

loadEnvOrExit("web", withDotenv(findRepoRoot()));
