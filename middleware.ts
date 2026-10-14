export { default } from 'next-auth/middleware'

export const config = {
  /**
   * Guard page routes only.
   *
   * `/api/*` is excluded deliberately: next-auth's middleware answers an
   * unauthenticated request with a 307 to the HTML login page, so a `fetch`
   * from the dashboard would follow the redirect and then fail parsing HTML as
   * JSON — surfacing as a confusing error instead of "not signed in". Every API
   * handler calls getServerSession and returns a JSON 401 itself, so excluding
   * them here loses no protection and gives clients an honest status code.
   */
  matcher: ['/((?!api|login|_next/static|_next/image|favicon.ico).*)'],
}
