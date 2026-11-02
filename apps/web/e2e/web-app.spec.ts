import { expect, test } from "./fixtures";

test("홈 화면 앱 설정과 아이콘은 로그인 전후 화면에서 제공된다", async ({
  page,
  request,
}) => {
  for (const path of ["/auth/login", "/settings/sharing"]) {
    await page.goto(path);
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      "href",
      "/manifest.webmanifest",
    );
    await expect(
      page.locator('meta[name="apple-mobile-web-app-capable"]'),
    ).toHaveAttribute("content", "yes");
    await expect(
      page.locator('meta[name="apple-mobile-web-app-title"]'),
    ).toHaveAttribute("content", "한달살림");
    const apple = page.locator('link[rel="apple-touch-icon"]');
    await expect(apple).toHaveAttribute("sizes", "180x180");
    const icon = await request.get((await apple.getAttribute("href"))!);
    expect(icon.ok()).toBe(true);
    expect(icon.headers()["content-type"]).toContain("image/png");
  }
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest).toMatchObject({
    name: "한달살림",
    start_url: "/",
    scope: "/",
    display: "standalone",
  });
  for (const icon of manifest.icons) {
    const response = await request.get(icon.src);
    expect(response.ok()).toBe(true);
    const png = await response.body();
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    expect(icon.sizes).toBe(`${width}x${height}`);
  }
});
