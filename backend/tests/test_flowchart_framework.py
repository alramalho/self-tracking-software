import pytest
import asyncio
from ai.assistant.flowchart_framework import FlowchartLLMFramework
from scripts.spike import FLOWCHART
import time
from typing import Dict, Any, List


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
    