String? accessRedirect({
  required String location,
  required bool signedIn,
  required bool portal,
  required bool laboratory,
}) {
  final login = location == '/login';
  final portalPage = location == '/portal' || location.startsWith('/portal/');
  if (!signedIn && !login) return '/login';
  if (portal) {
    if (login || location == '/' || location.isEmpty || location == '/painel') {
      return '/portal';
    }
    if (!portalPage) return '/portal';
    return null;
  }
  if (laboratory &&
      (login || portalPage || location == '/' || location.isEmpty)) {
    return '/painel';
  }
  return null;
}
