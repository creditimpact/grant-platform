from locust import HttpUser, task

class UserFlow(HttpUser):
    @task
    def full_flow(self):
        self.client.get('/status')
        self.client.get('/api/auth/csrf-token')
