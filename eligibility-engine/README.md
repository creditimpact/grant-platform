# Eligibility Engine

This microservice will evaluate business data against government grant
criteria and return a list of programs that the business qualifies for.
Future versions will load rule definitions from `grants_config.json` and
use them to determine eligibility. The goal is to keep the service
modular so it can be expanded with more sophisticated logic and easily
integrated with other components of the platform.
