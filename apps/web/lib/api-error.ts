export interface ApiFormError {
  message: string;
  upgradeHref?: string;
}

interface ApiErrorBody {
  error?: string;
  message?: string;
  requiredPlanId?: string;
}

export async function readApiFormError(response: Response, fallback: string): Promise<ApiFormError> {
  const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
  const message = body.message ?? fallback;

  if (response.status === 402 && body.error === "plan_limit_exceeded") {
    return {
      message,
      upgradeHref: "/settings/billing"
    };
  }

  return { message };
}
