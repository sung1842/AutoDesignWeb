// 아직 구현되지 않은 명령(이후 마일스톤 산출물). 이름과 담당 마일스톤을 출력하고 종료 코드 1.
const [name = "?", milestone = "?"] = process.argv.slice(2);
process.stderr.write(`${name}: 아직 구현되지 않음(${milestone} 산출물, 09장 9.4)\n`);
process.exitCode = 1;
