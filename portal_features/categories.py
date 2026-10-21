"""The two active categories. Historical divisions are retained, not deleted."""
CATEGORIES = ('Featherweight', 'Lightweight')

def category(value):
    from portal import Error
    if value not in CATEGORIES:
        raise Error('Choose Featherweight or Lightweight')
    return value
