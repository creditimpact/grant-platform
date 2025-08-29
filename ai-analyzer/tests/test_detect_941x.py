from src.detectors import detect

SAMPLE = """
Adjusted Employer's QUARTERLY Federal Tax Return or Claim for Refund
Form 941-X  OMB No. 1545-0029
Employer identification number (EIN) 12-3456789
Enter the calendar year of the quarter you're correcting 2021
Check the ONE quarter you're correcting 1: January, February, March
Enter the date you discovered errors 05/01/2022
"""

def test_detect_941x():
    res = detect(SAMPLE)
    assert res["type"]["key"] == "IRS_941X"
    f = res["extracted"]["fields"]
    assert f["ein"] == "123456789"
    assert f["year"] == "2021"
    assert f["quarter"] == "1"
