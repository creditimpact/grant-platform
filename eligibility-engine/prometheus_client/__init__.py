class Histogram:
    def __init__(self, name, desc, labelnames):
        self.name = name
    def labels(self, *args):
        return self
    def observe(self, value):
        pass

CONTENT_TYPE_LATEST = 'text/plain'

def generate_latest():
    return b''
