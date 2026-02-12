from django.core.management.base import BaseCommand
from django.utils import timezone

from anonymizer.models import AnonymousRepo


class Command(BaseCommand):
    help = "Mark expired anonymous repos as expired"

    def handle(self, *args, **options):
        expired = AnonymousRepo.objects.filter(
            status="active",
            expires_at__lt=timezone.now(),
        ).update(status="expired")

        self.stdout.write(self.style.SUCCESS(f"Marked {expired} repos as expired"))
