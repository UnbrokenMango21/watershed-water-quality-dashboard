package org.watershed.pawatershedwatch

import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AccountCircle
import androidx.compose.material.icons.rounded.History
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController

private object Routes {
    const val Home = "home"
    const val Recent = "recent"
    const val Account = "account"
    const val SelectSite = "select-site"
    const val Visit = "visit-details"
    const val TestMethod = "test-method"
    const val Measurements = "measurements"
    const val Media = "notes-media"
    const val Review = "review"
    const val Detail = "detail/{recordId}"
    const val Correction = "correction/{recordId}"
    const val Status = "status/{recordId}"

    fun detail(id: String) = "detail/$id"
    fun correction(id: String) = "correction/$id"
    fun status(id: String) = "status/$id"

    fun step(value: WorkflowStep) = when (value) {
        WorkflowStep.Site -> SelectSite
        WorkflowStep.VisitDetails -> Visit
        WorkflowStep.TestMethod -> TestMethod
        WorkflowStep.Measurements -> Measurements
        WorkflowStep.NotesMedia -> Media
        WorkflowStep.Review -> Review
    }
}

private data class Tab(val route: String, val label: String, val icon: ImageVector)

@Composable
fun PAWatershedApp(model: AppViewModel) {
    if (model.authLoading) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        return
    }
    if (!model.isSignedIn) {
        SignInScreen(model)
        return
    }
    val navController = rememberNavController()
    val tabs = remember {
        listOf(
            Tab(Routes.Home, "Home", Icons.Rounded.Home),
            Tab(Routes.Recent, "Recent", Icons.Rounded.History),
            Tab(Routes.Account, "Account", Icons.Rounded.AccountCircle),
        )
    }
    val backStack by navController.currentBackStackEntryAsState()
    val destination = backStack?.destination
    val mainRoute = tabs.any { tab -> destination?.hierarchy?.any { it.route == tab.route } == true }
    var replaceDraft by remember { mutableStateOf(false) }

    fun navigateToDraftStep() {
        val step = WorkflowStep.entries.firstOrNull { it.number == model.draft?.currentStep } ?: WorkflowStep.Site
        navController.navigate(Routes.step(step))
    }

    fun navigateToIssue(issue: ReviewIssue) {
        model.requestMeasurementFocus(issue.measurementKind)
        model.setStep(issue.step.number)
        val route = Routes.step(issue.step)
        navController.navigate(route) {
            popUpTo(route)
            launchSingleTop = true
        }
    }

    Scaffold(
        bottomBar = {
            if (mainRoute) {
                NavigationBar(tonalElevation = 4.dp) {
                    tabs.forEach { tab ->
                        val selected = destination?.hierarchy?.any { it.route == tab.route } == true
                        NavigationBarItem(
                            selected = selected,
                            onClick = {
                                navController.navigate(tab.route) {
                                    popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = { Icon(tab.icon, contentDescription = tab.label) },
                            label = { Text(tab.label) },
                        )
                    }
                }
            }
        },
    ) { outerPadding ->
        NavHost(
            navController = navController,
            startDestination = Routes.Home,
            modifier = Modifier.padding(outerPadding),
        ) {
            composable(Routes.Home) {
                HomeScreen(
                    model = model,
                    onStart = {
                        if (model.draft != null) replaceDraft = true
                        else {
                            model.startNewObservation()
                            navController.navigate(Routes.SelectSite)
                        }
                    },
                    onResume = ::navigateToDraftStep,
                    onRecord = { navController.navigate(Routes.detail(it)) },
                )
            }
            composable(Routes.Recent) {
                RecentScreen(model) { navController.navigate(Routes.detail(it)) }
            }
            composable(Routes.Account) { AccountScreen(model) }
            composable(Routes.SelectSite) {
                SelectSiteScreen(model, navController::popBackStack) { navController.navigate(Routes.Visit) }
            }
            composable(Routes.Visit) {
                VisitDetailsScreen(model, navController::popBackStack) { navController.navigate(Routes.TestMethod) }
            }
            composable(Routes.TestMethod) {
                TestMethodScreen(model, navController::popBackStack) { navController.navigate(Routes.Measurements) }
            }
            composable(Routes.Measurements) {
                MeasurementsScreen(model, navController::popBackStack) { navController.navigate(Routes.Media) }
            }
            composable(Routes.Media) {
                NotesMediaScreen(model, navController::popBackStack) { navController.navigate(Routes.Review) }
            }
            composable(Routes.Review) {
                ReviewScreen(model, navController::popBackStack, onFix = ::navigateToIssue) { id ->
                    navController.navigate(Routes.status(id)) {
                        popUpTo(Routes.Home)
                    }
                }
            }
            composable(Routes.Detail) { entry ->
                val id = entry.arguments?.getString("recordId").orEmpty()
                ObservationDetailScreen(model, id, navController::popBackStack) {
                    navController.navigate(Routes.correction(id))
                }
            }
            composable(Routes.Correction) { entry ->
                val id = entry.arguments?.getString("recordId").orEmpty()
                CorrectionRevisionScreen(model, id, navController::popBackStack) { recordId ->
                    navController.navigate(Routes.status(recordId)) {
                        popUpTo(Routes.detail(recordId))
                    }
                }
            }
            composable(Routes.Status) { entry ->
                val id = entry.arguments?.getString("recordId").orEmpty()
                SubmissionStatusScreen(
                    model,
                    id,
                    onHome = { navController.navigate(Routes.Home) { popUpTo(Routes.Home) { inclusive = true } } },
                    onDetail = { navController.navigate(Routes.detail(id)) },
                )
            }
        }
    }

    if (replaceDraft) {
        AlertDialog(
            onDismissRequest = { replaceDraft = false },
            title = { Text("Start a new observation?") },
            text = { Text("Your unfinished observation is saved on this phone. Starting over will discard that draft.") },
            confirmButton = {
                TextButton(onClick = {
                    replaceDraft = false
                    model.startNewObservation()
                    navController.navigate(Routes.SelectSite)
                }) { Text("Discard and Start") }
            },
            dismissButton = { TextButton(onClick = { replaceDraft = false }) { Text("Keep Draft") } },
        )
    }
}
