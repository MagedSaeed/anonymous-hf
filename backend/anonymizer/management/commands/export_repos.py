import csv
import sys

from django.core.management.base import BaseCommand

from anonymizer.models import AnonymousRepo


class Command(BaseCommand):
    help = "Export anonymous repos to CSV"

    def add_arguments(self, parser):
        parser.add_argument("--output", "-o", type=str, help="Output file path (default: stdout)")
        parser.add_argument(
            "--status", type=str, help="Filter by status (active, expired, deleted)"
        )

    def handle(self, *args, **options):
        qs = AnonymousRepo.objects.select_related("owner").all()

        if options["status"]:
            qs = qs.filter(status=options["status"])

        output = open(options["output"], "w", newline="") if options["output"] else sys.stdout

        writer = csv.writer(output)
        writer.writerow(
            [
                "anonymous_id",
                "repo_type",
                "branch",
                "status",
                "owner_username",
                "created_at",
                "expires_at",
                "view_count",
                "access_count",
            ]
        )

        for repo in qs:
            writer.writerow(
                [
                    repo.anonymous_id,
                    repo.repo_type,
                    repo.branch,
                    repo.status,
                    repo.owner.hf_username or repo.owner.username,
                    repo.created_at.isoformat(),
                    repo.expires_at.isoformat(),
                    repo.view_count,
                    repo.access_count,
                ]
            )

        if options["output"]:
            output.close()
            self.stdout.write(self.style.SUCCESS(f"Exported to {options['output']}"))
