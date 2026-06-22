import { NextResponse } from "next/server";

const installerUrl = "https://github.com/laxman-patel/agent-artifacts/releases/latest/download/install.sh";

export function GET(): NextResponse {
  return NextResponse.redirect(installerUrl, 308);
}
