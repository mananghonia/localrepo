from django.core.management.base import BaseCommand

from users.models import User
from users import services


class Command(BaseCommand):
    help = "Assign unique usernames to any existing users that are missing one."

    def handle(self, *args, **options):
        missing_query = User.objects(__raw__={
            '$or': [
                {'username': {'$exists': False}},
                {'username': None},
                {'username': ''},
            ]
        })

        count = missing_query.count()
        if not count:
            self.stdout.write(self.style.SUCCESS('All users already have usernames.'))
            return

        updated = 0
        for user in missing_query:
            seed = user.name or user.email.split('@')[0]
            user.username = services.build_unique_username(seed)
            user.save()
            updated += 1
            if updated % 50 == 0:
                self.stdout.write(f"Processed {updated}/{count} users...")

        self.stdout.write(self.style.SUCCESS(f"Assigned usernames for {updated} users."))
