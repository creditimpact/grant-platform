from form_filler import fill_form


def test_rural_development_forms_exist():
    data = {
        "applicant_name": "Test Org",
        "project_title": "Test Project",
        "duns_number": "123456789",
        "cage_code": "1A2B3",
        "sam_registration": True,
        "project_cost": 100000,
    }
    for form in [
        "form_sf424",
        "rd_1940_1",
        "rd_1942_46",
        "rd_400_1",
        "rd_400_4",
        "ad_1047",
        "ad_1049",
    ]:
        filled = fill_form(form, data)
        if form == "form_sf424":
            assert filled["fields"].get("OMB Number") == "4040-0004"
            assert any(
                sec.get("section") == "Applicant Information" for sec in filled.get("sections", [])
            )
        else:
            assert filled["fields"].get("applicant_name") == "Test Org"
            assert "duns_number" in filled["fields"]
