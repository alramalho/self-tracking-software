

from openai import OpenAI
from constants import OPENAI_API_KEY, GROQ_API_KEY
from groq import Groq
import instructor


openai_client = OpenAI(api_key=OPENAI_API_KEY)
instructor_groq_client = instructor.from_groq(Groq(api_key=GROQ_API_KEY), mode=instructor.Mode.JSON)
normal_groq_client = Groq(api_key=GROQ_API_KEY)
