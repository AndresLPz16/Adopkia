from types import SimpleNamespace

from django.utils import translation


class QueryLanguageMiddleware:
    supported_languages = frozenset({"es", "en"})
    default_language = "es"

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        language = request.GET.get("lang", "").lower()
        if language not in self.supported_languages:
            language = translation.get_language_from_path(request.path_info)
        if language not in self.supported_languages:
            language = translation.get_language_from_request(
                SimpleNamespace(COOKIES={}, META=request.META),
                check_path=False,
            )
        if language not in self.supported_languages:
            language = self.default_language

        translation.activate(language)
        request.LANGUAGE_CODE = language

        response = self.get_response(request)
        response.headers["Content-Language"] = language
        return response
