import { describe, expect, it } from "vitest";
import { devAutoLogin, redirectFor } from "./access";

describe("redirectFor", () => {
  it("manda para /login quem está sem sessão em /app", () => {
    expect(redirectFor("/app", false)).toBe("/login");
    expect(redirectFor("/app/leads/123", false)).toBe("/login");
  });

  it("manda para /app quem tem sessão e abre /login", () => {
    expect(redirectFor("/login", true)).toBe("/app");
  });

  it("deixa passar o resto", () => {
    expect(redirectFor("/", false)).toBeNull();
    expect(redirectFor("/login", false)).toBeNull();
    expect(redirectFor("/app/leads", true)).toBeNull();
    expect(redirectFor("/auth/callback", false)).toBeNull();
  });

  it("não confunde /apple com /app", () => {
    expect(redirectFor("/apple", false)).toBeNull();
  });
});

describe("entrada automática de desenvolvimento", () => {
  const env = { DEV_AUTO_LOGIN_EMAIL: "gestora@demo.local", DEV_AUTO_LOGIN_PASSWORD: "x" };

  it("só liga em desenvolvimento e com e-mail e senha definidos", () => {
    expect(devAutoLogin({ ...env, NODE_ENV: "development" })).toEqual({
      email: "gestora@demo.local",
      password: "x",
    });
    expect(devAutoLogin({ ...env, NODE_ENV: "production" })).toBeNull();
    expect(devAutoLogin({ ...env, NODE_ENV: "test" })).toBeNull();
    expect(devAutoLogin({ NODE_ENV: "development", DEV_AUTO_LOGIN_EMAIL: "a@b" })).toBeNull();
  });

  it("ligada, quem está sem sessão em /app entra direto em vez de ir ao /login", () => {
    expect(redirectFor("/app/leads", false, { autoLogin: true })).toBe("/dev/entrar");
    expect(redirectFor("/app", true, { autoLogin: true })).toBeNull();
  });
});
