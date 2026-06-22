import { NextResponse } from "next/server";

const installerUrl = "https://downloads.hostartifacts.dev/cli/latest/install.sh";

export function GET(): NextResponse {
  return NextResponse.redirect(installerUrl, 308);
}
