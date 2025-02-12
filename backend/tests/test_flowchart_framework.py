from shared.logger import create_logger
create_logger("DEBUG")
import pytest
from ai.assistant.flowchart_framework import FlowchartLLMFramework
import time
from ai.assistant.flowchart_nodes import Node, LoopStartNode, LoopContinueNode
from pydantic import BaseModel, Field
from typing import List
from entities.plan import PlanSession

class AllPlanNamesSchema(BaseModel):
    plan_names: List[str] = Field(..., description="All plan names")

class SuggestedNextWeekSessions(BaseModel):
    plan_name: str = Field(..., description="The name of the plan")
    next_week_sessions: List[PlanSession] = Field(
        ..., description="The sessions to be added to the plan for the upcoming week"
    )


# Simpler flowchart demonstrating parallel paths and dependencies
FLOWCHART = {
    "HasRequest": Node(
        text="Did the user made you request, question or instruction?",
        connections={"Yes": "Answer", "No": "ExtractPlanNames"},
    ),
    "Answer": Node(
        text="Address the user's request, having in mind your goals and purpose.",
    ),
    "ExtractPlanNames": Node(
        text="Extract all plan names from the users plan list.",
        connections={"default": "StartPlanLoop"},
        output_schema=AllPlanNamesSchema,
    ),
    "StartPlanLoop": LoopStartNode(
        text="",
        iterator="current_plan",
        collection="plan_names",
        connections={"default": "CheckPlanDiscussed"},
        needs=["ExtractPlanNames"],
        end_node="NexPlan"
    ),
    "CheckPlanDiscussed": Node(
        text="Based exclusively on the conversation history, did you ask the user if he wants to discuss the plan '${current_plan}'?",
        connections={"Yes": "CheckUserWantsToDiscussPlan", "No": "AskToDiscussPlan"},
    ),
    "AskToDiscussPlan": Node(
        text="Ask the user if they would like to discuss the plan '${current_plan}', making a bridge to the conversation and giving an overview on how the plan is doing by the outlook of recent user activity.",
        temperature=1,
    ),
    "CheckUserWantsToDiscussPlan": Node(
        text="Based exclusively on the conversation history, has the user accepted to discuss the plan '${current_plan}'?",
        connections={"Yes": "CheckUserMentionedNextWeekPlans", "No": "NextPlan"},
    ),
    "CheckUserMentionedNextWeekPlans": Node(
        text="Did the user explictly mention in the conversation history which upcoming week's sessions for plan ${current_plan}' he is intending on doing? Note that a mention that no adjustments are needed is also an explicit mention and should be answered with 'Yes'",
        connections={"Yes": "ShouldSuggestChanges", "No": "AskNextWeekPlans"},
    ),
    "AskNextWeekPlans": Node(
        text="Remind the user of his upcoming week planned sessions for '${current_plan}' and ask what's his plans about it / if he plans on doing them all.",
        temperature=1,
    ),
    "ShouldSuggestChanges": Node(
        text="Based on recent conversation history & user's intentions regarding the plan '${current_plan}', should you suggest any change to '${current_plan}' upcoming week's sessions? You must start your reasoning with \"Based on the conversation history for plan '${current_plan}' ...\".",
        connections={"Yes": "SuggestChanges", "No": "NextPlan"},
    ),
    "SuggestChanges": Node(
        text="Analyse and suggest changes for plan '${current_plan}'. You can only make changes to the plan sessions date & details.",
        temperature=1,
        output_schema=SuggestedNextWeekSessions,
        connections={"default": "InformTheUsreAboutTheChanges"},
    ),
    "InformTheUsreAboutTheChanges": Node(
        text="Inform the user that you've generated sessions replacing next week's ones for plan '${current_plan}', which now he needs to accept or reject.",
        needs=["SuggestChanges"],
    ),
    "NextPlan": LoopContinueNode(
        text="",
        connections={"HasMore": "StartPlanLoop", "Complete": "Conclude"},
        needs=["StartPlanLoop"],
    ),
    "Conclude": Node(
        text="Congratulate the user for making this far in the conversation, wrap up the conversation with a summary of what was discussed and what actions were decided and tell him you'll see him next week!",
        temperature=1,
    ),
}


@pytest.fixture
def system_prompt() -> str:
    return """You are jarvis, an AI assistant helping the adapt their plans for the following week. 
    Respond to the user in the same language that he talks to you in.
    Your instruction will always be very specific, so make sure you do the appropriate conversation bridge.
    """


@pytest.fixture
def input_string() -> str:
    return """
        --- Here's the user's plan list of 4 plans:
        Plan 1 (with ID '6711a1b3b56e3f2ec95c9181'): Name: 'get fit' (ends Tuesday, Dec 31)
        Sessions that the user PLANNED (not necessarily done) in the last 6 days:
        - Monday, Dec 09 - gym (ID: 6711a1b3b56e3f2ec95c9182) (1 sessions)
        - Wednesday, Dec 11 - running (ID: 6711a1b3b56e3f2ec95c9183) (8 kilometers)
        - Thursday, Dec 12 - gym (ID: 6711a1b3b56e3f2ec95c9182) (1 sessions)
        - Saturday, Dec 14 - running (ID: 6711a1b3b56e3f2ec95c9183) (10 kilometers)

        Upcoming sessions in the next 6 days:
        - Monday, Dec 16 - gym (ID: 6711a1b3b56e3f2ec95c9182) (1 sessions)
        - Wednesday, Dec 18 - running (ID: 6711a1b3b56e3f2ec95c9183) (9 kilometers)
        - Thursday, Dec 19 - gym (ID: 6711a1b3b56e3f2ec95c9182) (1 sessions)
        - Saturday, Dec 21 - running (ID: 6711a1b3b56e3f2ec95c9183) (8 kilometers)

        Plan 2 (with ID '67229dc8a9c5dddd57c30a83'): Name: 'Read 1 book' (ends Tuesday, Jan 28)
        Sessions that the user PLANNED (not necessarily done) in the last 6 days:
        - Monday, Dec 09 - reading (ID: 6713ab63baaf861c0d3d1d25) (15 pages)
        - Tuesday, Dec 10 - reading (ID: 6713ab63baaf861c0d3d1d25) (15 pages)
        - Thursday, Dec 12 - reading (ID: 6713ab63baaf861c0d3d1d25) (30 pages)
        - Saturday, Dec 14 - reading (ID: 6713ab63baaf861c0d3d1d25) (20 pages)

        Upcoming sessions in the next 6 days:
        - Monday, Dec 16 - reading (ID: 6713ab63baaf861c0d3d1d25) (15 pages)
        - Tuesday, Dec 17 - reading (ID: 6713ab63baaf861c0d3d1d25) (15 pages)
        - Thursday, Dec 19 - reading (ID: 6713ab63baaf861c0d3d1d25) (30 pages)
        - Saturday, Dec 21 - reading (ID: 6713ab63baaf861c0d3d1d25) (30 pages)

        Plan 3 (with ID '672d5e0783e074f2ab227579'): Name: 'i want my side project to reach 1000 users' (ends Monday, Dec 30)
        Sessions that the user PLANNED (not necessarily done) in the last 6 days:
        - Monday, Dec 09 - work on side project (ID: 672d5d7683e074f2ab227571) (3 hours)
        - Wednesday, Dec 11 - work on side project (ID: 672d5d7683e074f2ab227571) (3 hours)
        - Friday, Dec 13 - work on side project (ID: 672d5d7683e074f2ab227571) (3 hours)
        - Saturday, Dec 14 - work on side project (ID: 672d5d7683e074f2ab227571) (3 hours)

        Upcoming sessions in the next 6 days:
        - Monday, Dec 16 - work on side project (ID: 672d5d7683e074f2ab227571) (3 hours)
        - Wednesday, Dec 18 - work on side project (ID: 672d5d7683e074f2ab227571) (3 hours)
        - Friday, Dec 20 - work on side project (ID: 672d5d7683e074f2ab227571) (3 hours)
        - Saturday, Dec 21 - work on side project (ID: 672d5d7683e074f2ab227571) (3 hours)

        --- Here's user's actually done activities during last week:
        Thursday, Dec 12 2024 (3 days ago) - reading (10 pages)
        Wednesday, Dec 11 2024 (4 days ago) - gym (1 sessions)
        Tuesday, Dec 10 2024 (4 days ago) - running (6 kilometers)
        Monday, Dec 09 2024 (5 days ago) - bouldering (1 sessions)
                               
        --- Now here's your actual conversation history with the user:
        ... (older than 1440 minutes messages omitted) ...
        > Alex Ramalho (19 hours ago): wassup
        > Jarvis (19 hours ago): Hey Alex! It seems like you've been really committed to your "get fit" plan lately, with some great sessions in the gym and your running activities. You have a couple of gym sessions coming up on Monday and Thursday, as well as runs scheduled for Wednesday and Saturday, so you're well-positioned to keep that momentum going!

        Would you like to discuss your "get fit" plan in more detail?
        > Alex Ramalho (19 hours ago): Sure thing, let's go.
        > Jarvis (19 hours ago): Great to hear you're ready to discuss your "get fit" plan, Alex! You've been doing an excellent job with your sessions, and it's clear you're determined to keep the momentum going. 

        Looking at your upcoming schedule, you have:

        - **Monday, Dec 16**: Gym (1 session)
        - **Wednesday, Dec 18**: Running (9 kilometers)
        - **Thursday, Dec 19**: Gym (1 session)
        - **Saturday, Dec 21**: Running (8 kilometers)

        Do you plan on doing all of these activities?
        > Alex (19 hours ago): Yeah, I do!
        > Jarvis (19 hours ago): Great to hear that, Alex! I'm sure you'll do great.
        """


@pytest.mark.asyncio
async def test_flowchart_execution_time(system_prompt: str, input_string: str):
    # Initialize framework
    framework = FlowchartLLMFramework(FLOWCHART, system_prompt, lookahead_depth=6)
    
    # Run the framework and measure time
    start_time = time.time()
    result, extracted = await framework.run(input_string)
    total_execution_time = time.time() - start_time
    
    # Get node durations from the framework
    node_durations = framework.node_durations
    
    # Calculate expected execution time
    initial_nodes_time = max(
        node_durations.get('ExtractPlanNames_0', 0),
        node_durations.get('HasRequest_0', 0)
    )
    
    parallel_nodes_time = max(
        node_durations.get('StartPlanLoop_0', 0),
        node_durations.get('CheckPlanDiscussed_0', 0),
        node_durations.get('CheckUserWantsToDiscussPlan_0', 0),
        node_durations.get('CheckUserMentionedNextWeekPlans_0', 0),
        node_durations.get('ShouldSuggestChanges_0', 0),
        node_durations.get('NextPlan_0', 0),
        node_durations.get('StartPlanLoop_1', 0),
        node_durations.get('CheckPlanDiscussed_1', 0),
        node_durations.get('AskToDiscussPlan_1', 0)
    )
    
    expected_time = (initial_nodes_time + parallel_nodes_time) / 1000  # Convert to seconds
    margin = 0.5  # 500ms margin
    
    # Assert execution time is within expected range
    assert abs(total_execution_time - expected_time) <= margin, (
        f"Execution time {total_execution_time:.2f}s was not within {margin}s "
        f"of expected time {expected_time:.2f}s"
    )
    # Verify traversal order
    expected_nodes = [
        'HasRequest_0',
        'ExtractPlanNames_0',
        'StartPlanLoop_0',
        'CheckPlanDiscussed_0',
        'CheckUserWantsToDiscussPlan_0',
        'CheckUserMentionedNextWeekPlans_0',
        'ShouldSuggestChanges_0',
        'NextPlan_0',
        'StartPlanLoop_1',
        'CheckPlanDiscussed_1',
        'AskToDiscussPlan_1'
    ]
    
    actual_nodes = [node for node in framework.execution_path]
    assert actual_nodes == expected_nodes, (
        f"Unexpected traversal order.\nExpected: {expected_nodes}\nActual: {actual_nodes}"
    ) 

    # Print execution summary in green
    print("\n\033[92m=== Test Execution Summary ===")
    print(f"Total execution time: {total_execution_time:.2f}s")
    print(f"Expected execution time: {expected_time:.2f}s")
    print(f"Initial nodes time (max of HasRequest_0, ExtractPlanNames_0): {initial_nodes_time/1000:.2f}s")
    print(f"Parallel nodes time (max of remaining nodes): {parallel_nodes_time/1000:.2f}s\033[0m")
    

@pytest.mark.asyncio
async def test_flowchart_with_alternative_history(system_prompt: str):
    # Different input string with focus on project work
    input_string = """
        --- Here's the user's plan list of 4 plans:
        Plan 1 (with ID '6711a1b3b56e3f2ec95c9181'): Name: 'get fit' (ends Tuesday, Dec 31)
        Sessions that the user PLANNED (not necessarily done) in the last 6 days:
        - Thursday, Dec 12 - gym (ID: 6711a1b3b56e3f2ec95c9182) (1 sessions)
        - Saturday, Dec 14 - running (ID: 6711a1b3b56e3f2ec95c9183) (10 kilometers)
        - Monday, Dec 16 - gym (ID: 6711a1b3b56e3f2ec95c9182) (1 sessions)
        - Wednesday, Dec 18 - running (ID: 6711a1b3b56e3f2ec95c9183) (9 kilometers)

        Upcoming sessions in the next 6 days:
        - Thursday, Dec 19 - gym (ID: 6711a1b3b56e3f2ec95c9182) (1 sessions)
        - Saturday, Dec 21 - running (ID: 6711a1b3b56e3f2ec95c9183) (8 kilometers)
        - Monday, Dec 23 - gym (ID: 6711a1b3b56e3f2ec95c9182) (1 sessions)

        Plan 2 (with ID '67229dc8a9c5dddd57c30a83'): Name: 'Read 1 book' (ends Tuesday, Jan 28)
        Sessions that the user PLANNED (not necessarily done) in the last 6 days:
        - Thursday, Dec 12 - reading (ID: 6713ab63baaf861c0d3d1d25) (30 pages)
        - Saturday, Dec 14 - reading (ID: 6713ab63baaf861c0d3d1d25) (20 pages)
        - Monday, Dec 16 - reading (ID: 6713ab63baaf861c0d3d1d25) (15 pages)
        - Tuesday, Dec 17 - reading (ID: 6713ab63baaf861c0d3d1d25) (15 pages)

        Upcoming sessions in the next 6 days:
        - Thursday, Dec 19 - reading (ID: 6713ab63baaf861c0d3d1d25) (30 pages)
        - Saturday, Dec 21 - reading (ID: 6713ab63baaf861c0d3d1d25) (30 pages)
        - Monday, Dec 23 - reading (ID: 6713ab63baaf861c0d3d1d25) (15 pages)
        - Tuesday, Dec 24 - reading (ID: 6713ab63baaf861c0d3d1d25) (15 pages)

        Plan 3 (with ID '672d5e0783e074f2ab227579'): Name: 'i want my side project to reach 1000 users' (ends Monday, Dec 30)
        Sessions that the user PLANNED (not necessarily done) in the last 6 days:
        - Friday, Dec 13 - work on side project (ID: 672d5d7683e074f2ab227571) (3 hours)
        - Saturday, Dec 14 - work on side project (ID: 672d5d7683e074f2ab227571) (3 hours)
        - Monday, Dec 16 - work on side project (ID: 672d5d7683e074f2ab227571) (3 hours)
        - Wednesday, Dec 18 - work on side project (ID: 672d5d7683e074f2ab227571) (3 hours)

        Upcoming sessions in the next 6 days:
        - Friday, Dec 20 - work on side project (ID: 672d5d7683e074f2ab227571) (3 hours)
        - Saturday, Dec 21 - work on side project (ID: 672d5d7683e074f2ab227571) (3 hours)
        - Monday, Dec 23 - work on side project (ID: 672d5d7683e074f2ab227571) (3 hours)

        --- Here's user's actually done activities during last week:
        Monday, Dec 16 2024 (yesterday) - running (4 kilometers)
        Wednesday, Dec 11 2024 (6 days ago) - running (4 kilometers)
        Thursday, Dec 12 2024 (6 days ago) - reading (10 pages)
        Wednesday, Dec 11 2024 (6 days ago) - gym (1 sessions)
                               
        --- Now here's your actual conversation history with the user:
        ... (older than 1440 minutes messages omitted) ...
        > Jarvis (13 hours ago): Your side project is eager for some attention! What's one action you can take this week to get closer to that 1000 user goal? 🖥️
        > Jarvis (13 hours ago): You're making strides in running, but how about setting a new distance challenge for the week? What's the next goal you want to hit? 🏃‍♀️
        > Jarvis (13 hours ago): You're making strides with your running! What's one distance you want to push yourself to this week? 🏃‍♀️
        > Alex Ramalho (13 hours ago): sup
        > Jarvis (13 hours ago): Hey Alex! It looks like you've been quite active with your running and gym sessions as part of your 'get fit' plan. You've planned some great distances and have even managed to complete 4 kilometers yesterday. Would you like to discuss any adjustments or goals for this plan moving forward? 🏃‍♀️💪
        > Jarvis (13 hours ago): Looks like your reading goal is on hold! What's one book you've been wanting to dive into that could spark your interest? 📖
        > Jarvis (13 hours ago): Your reading goal seems to be on hold! What's one book you've been wanting to dive into this week? 📖
        > Alex Ramalho (13 hours ago): Yeah, I've kind of been focusing on my pet project.
        --- Today (2024-12-18) ---
        > Alex Ramalho (Just now): hey
    """
    
    # Initialize framework
    framework = FlowchartLLMFramework(FLOWCHART, system_prompt, lookahead_depth=6)
    
    try:
        # Run the framework
        result, extracted = await framework.run(input_string)
        
        # Basic assertions that don't depend on specific response content
        assert isinstance(result, str), "Result should be a string"
        assert result != "", "Result should not be empty"
        
        # Print execution summary
        print("\n\033[92m=== Test Execution Summary ===")
        print(f"Response received: {result[:100]}...")  # Print first 100 chars
        print(f"Number of nodes executed: {len(framework.execution_path)}")
        print(f"Execution path: {' -> '.join(framework.execution_path)}\033[0m")
        
    except Exception as e:
        pytest.fail(f"Test failed with exception: {str(e)}")
    