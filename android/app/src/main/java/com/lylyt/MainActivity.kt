package com.lylyt

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "Lylyt"

  /**
   * Returns the instance of the [ReactActivityDelegate]. 
   * Explicitly disable New Architecture (fabricEnabled=false) to avoid PlatformConstants error
   * This matches the working project configuration
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, false)
}
