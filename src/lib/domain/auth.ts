/** Safe, actionable messages; never echo provider details or credentials. */
export function loginErrorMessage(error: { code?: string; status?: number; name?: string }): string {
  if (error.code === "invalid_credentials") return "E-mail ou senha inválidos. Use o acesso do laboratório; ele pode ser diferente do ERP da ótica.";
  if (error.code === "email_not_confirmed") return "Confirme seu e-mail antes de entrar no laboratório.";
  if (error.status === 429 || error.code === "over_request_rate_limit") return "Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.";
  if (error.name === "AuthRetryableFetchError" || error.status === 0 || (error.status ?? 0) >= 500) return "O serviço de acesso está indisponível no momento. Tente novamente em instantes.";
  return "Não foi possível concluir o acesso. Tente novamente ou fale com o administrador do laboratório.";
}
