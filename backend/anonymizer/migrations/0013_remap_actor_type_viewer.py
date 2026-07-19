from django.db import migrations


def remap_forward(apps, schema_editor):
    ActivityLog = apps.get_model("anonymizer", "ActivityLog")
    ActivityLog.objects.filter(actor_type__in=["anonymous", "non_owner"]).update(
        actor_type="viewer"
    )


def remap_backward(apps, schema_editor):
    # Irreversible collapse; leave rows as-is on reverse.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("anonymizer", "0012_drop_counters_alter_actor_type"),
    ]

    operations = [
        migrations.RunPython(remap_forward, remap_backward),
    ]
