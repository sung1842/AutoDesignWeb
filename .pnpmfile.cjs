// next의 선택 peer `@playwright/test`를 끊는다. 루트 e2e 전용 의존성이 web 의존성 트리에 붙지 않게(AC-09-09, AD-033).
module.exports = {
  hooks: {
    readPackage(pkg) {
      if (pkg.name === "next") {
        if (pkg.peerDependencies) delete pkg.peerDependencies["@playwright/test"];
        if (pkg.peerDependenciesMeta) delete pkg.peerDependenciesMeta["@playwright/test"];
      }
      return pkg;
    },
  },
};
